import execa = require('execa')
import fs from 'fs'
import os from 'os'
import path from 'path'
import yargs = require('yargs')
import tmp from 'tmp'

import { logger } from './logger'
import { ShellContributor } from './shell-contributor'
import {
    CeremonyParticipant,
    CeremonyContributor,
    CeremonyVerifier,
} from './ceremony-participant'
import { ChunkData } from './coordinator'

function copy(source, target): Promise<unknown> {
    const reader = fs.createReadStream(source)
    const writer = fs.createWriteStream(target)
    const finish = new Promise((resolve) => writer.on('close', resolve))
    reader.pipe(writer)
    return finish
}

async function powersoftau(): Promise<void> {
    const passThroughArgs = process.argv.slice(3)
    const powersoftauFileName = {
        Linux: 'powersoftau_linux.file',
        Darwin: 'powersoftau_macos.uu',
        Windows_NT: 'powersoftau.exe', // eslint-disable-line @typescript-eslint/camelcase
    }[os.type()]
    if (typeof powersoftauFileName === 'undefined') {
        logger.error(`Unsupported OS type: ${os.type()}`)
        process.exit(1)
    }
    const powersoftauPath = path.normalize(
        path.join(__dirname, '..', 'powersoftau', powersoftauFileName),
    )

    const tmpFile = tmp.fileSync({
        mode: 0o775,
        prefix: 'powersoftau-extracted-',
        discardDescriptor: true,
    })
    await copy(powersoftauPath, tmpFile.name)

    const subprocess = execa(tmpFile.name, passThroughArgs)
    subprocess.stdout.pipe(process.stdout)
    subprocess.stderr.pipe(process.stderr)
    try {
        await subprocess
    } catch (err) {
        // If exitCode is missing it probably means we couldn't even run the
        // powersoftau, which might indicate a bug somewhere in this code.
        if (typeof subprocess.exitCode === 'undefined') {
            logger.error(err)
            process.exit(1)
        }
        process.exit(subprocess.exitCode)
    }
}

function sleep(msec): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, msec))
}

async function work({
    client,
    contributor,
}: {
    client: CeremonyParticipant
    contributor: (chunk: ChunkData) => ShellContributor
}): Promise<void> {
    const lockBackoffMsecs = 5000

    let incompleteChunks = await client.getChunksRemaining()
    while (incompleteChunks.length) {
        const ceremony = await client.getCeremony()
        const completedChunkCount =
            ceremony.chunks.length - incompleteChunks.length
        const remainingChunkIds = incompleteChunks.map((chunk) => chunk.chunkId)
        logger.info(
            `completed ${completedChunkCount} / ${ceremony.chunks.length}`,
        )
        logger.info(`incomplete chunks: %o`, remainingChunkIds)
        const chunk = await client.getLockedChunk()
        if (chunk) {
            logger.info(`locked chunk ${chunk.chunkId}`)
            try {
                // TODO: pull up out of if and handle errors
                const contribute = contributor(chunk)
                await contribute.load()

                const contributionPath = await contribute.run()
                logger.info('uploading contribution %s', contributionPath)
                const content = fs.readFileSync(contributionPath).toString()
                await client.contributeChunk(chunk.chunkId, content)

                contribute.cleanup()
            } catch (error) {
                logger.warn(error, 'contributor failed')
                // TODO(sbw)
                // await client.unlockChunk(chunk.chunkId)
            }
        } else {
            logger.info('unable to lock chunk')
        }
        await sleep(lockBackoffMsecs)
        incompleteChunks = await client.getChunksRemaining()
    }

    logger.info('no more chunks remaining')
}

async function main(): Promise<void> {
    if (process.argv[2] === 'powersoftau') {
        await powersoftau()
        return
    }

    const participateArgs = {
        'api-url': {
            default: 'http://localhost:8080',
            type: 'string',
            describe: 'Ceremony API url',
        },
        'participant-id': {
            type: 'string',
            demand: true,
            describe: 'ID of ceremony participant',
        },
    }

    const args = yargs
        .env('COORDINATOR')
        .command(
            'contribute',
            'Run the process to make contributions',
            participateArgs,
        )
        .command(
            'verify',
            'Run the process to verify contributions',
            participateArgs,
        )
        .command('powersoftau', 'Run powersoftau command directly', (yargs) => {
            return yargs.help(false).version(false)
        })
        .strictCommands()
        .help().argv

    logger.info('invoked with args %o', args)

    const participantId = args.participantId
    const mode = args._[0]
    const baseUrl = args.apiUrl

    let client
    if (mode === 'contribute') {
        client = new CeremonyContributor({ participantId, baseUrl })
    } else if (mode === 'verify') {
        client = new CeremonyVerifier({ participantId, baseUrl })
    } else {
        logger.error(`Unexpected mode ${mode}`)
        process.exit(1)
    }

    const contributor = (chunkData: ChunkData): ShellContributor => {
        return new ShellContributor({
            chunkData: chunkData,
            contributorCommand: './contributor/mock.sh',
        })
    }

    work({ client, contributor }).catch((err) => {
        logger.error(err)
        process.exit(1)
    })
}

main()
