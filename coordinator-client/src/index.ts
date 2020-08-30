import dotenv from 'dotenv'
import execa = require('execa')
import fs from 'fs'
import os from 'os'
import path from 'path'
import yargs = require('yargs')
import tmp from 'tmp'

import { logger } from './logger'
import {
    PowersoftauNew,
    ShellContributor,
    ShellVerifier,
    ShellCommand,
} from './shell-contributor'
import {
    CeremonyParticipant,
    CeremonyContributor,
    CeremonyVerifier,
} from './ceremony-participant'
import { ChunkData } from './ceremony'

dotenv.config()

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
    contributor: (chunk: ChunkData) => ShellCommand
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
                const content = fs.readFileSync(contributionPath)
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

async function newChallenge(args): Promise<void> {
    const powersoftauNew = new PowersoftauNew({
        contributorCommand: './contributor/powersoftau',
        seed: args.seed,
    })

    for (let chunkIndex = 0; chunkIndex < args.count; chunkIndex++) {
        logger.info(`creating challenge ${chunkIndex + 1} of ${args.count}`)
        await powersoftauNew.run({
            chunkIndex,
            contributionPath: path.join(args.destination, `${chunkIndex}.0`),
        })
    }
}

async function main(): Promise<void> {
    if (process.argv[2] === 'powersoftau') {
        await powersoftau()
        return
    }

    const powersoftauArgs = {
        seed: {
            type: 'string',
            demand: true,
            describe: '32-character hexadecimal seed value',
        },
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
        .command('contribute', 'Run the process to make contributions', {
            ...participateArgs,
            powersoftauArgs,
        })
        .command('verify', 'Run the process to verify contributions', {
            ...participateArgs,
            powersoftauArgs,
        })
        .command('new', 'Create new challenges for a ceremony', {
            ...powersoftauArgs,
            count: {
                type: 'number',
                demand: true,
                describe: 'Number of challenges',
            },
            destination: {
                type: 'string',
                describe: 'Directory to create challenge files in',
                default: process.cwd(),
            },
        })
        .command('powersoftau', 'Run powersoftau command directly', (yargs) => {
            return yargs.help(false).version(false)
        })
        .demandCommand(1, 'You must specify a command.')
        .strictCommands()
        .help().argv

    logger.info('invoked with args %o', args)

    const participantId = args.participantId
    const mode = args._[0]
    const baseUrl = args.apiUrl

    let client
    let contributor
    if (mode === 'contribute') {
        client = new CeremonyContributor({ participantId, baseUrl })
        contributor = (chunkData: ChunkData): ShellContributor => {
            return new ShellContributor({
                chunkData: chunkData,
                contributorCommand: './powersoftau/powersoftau_linux.file',
                seed: args.seed,
            })
        }
    } else if (mode === 'verify') {
        client = new CeremonyVerifier({ participantId, baseUrl })
        contributor = (chunkData: ChunkData): ShellVerifier => {
            return new ShellVerifier({
                chunkData: chunkData,
                contributorCommand: './powersoftau/powersoftau_linux.file',
                seed: args.seed,
            })
        }
    } else if (mode === 'new') {
        newChallenge(args)
        return
    } else {
        logger.error(`Unexpected mode ${mode}`)
        process.exit(1)
    }

    work({ client, contributor }).catch((err) => {
        logger.error(err)
        process.exit(1)
    })
}

main()
