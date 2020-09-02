import dotenv from 'dotenv'
import execa = require('execa')
import fs from 'fs'
import path from 'path'
import yargs = require('yargs')
import tmp from 'tmp'

import { logger } from './logger'
import {
    extractPowersoftau,
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
tmp.setGracefulCleanup()

async function powersoftau(): Promise<void> {
    const passThroughArgs = process.argv.slice(3)
    const tmpFile = await extractPowersoftau()

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

async function contribute(args): Promise<void> {
    const participantId = args.participantId
    const baseUrl = args.apiUrl

    const client = new CeremonyContributor({ participantId, baseUrl })
    const contributor = (chunkData: ChunkData): ShellContributor => {
        return new ShellContributor({
            chunkData: chunkData,
            contributorCommand: args.command,
            seed: args.seed,
        })
    }

    await work({ client, contributor })
}

async function verify(args): Promise<void> {
    const participantId = args.participantId
    const baseUrl = args.apiUrl

    const client = new CeremonyVerifier({ participantId, baseUrl })
    const contributor = (chunkData: ChunkData): ShellVerifier => {
        return new ShellVerifier({
            chunkData: chunkData,
            contributorCommand: args.command,
            seed: args.seed,
        })
    }

    await work({ client, contributor })
}

async function newChallenge(args): Promise<void> {
    const powersoftauNew = new PowersoftauNew({
        contributorCommand: args.command,
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
        command: {
            type: 'string',
            describe: 'Override the built-in powersoftau command',
        },
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
            ...powersoftauArgs,
        })
        .command('verify', 'Run the process to verify contributions', {
            ...participateArgs,
            ...powersoftauArgs,
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
        .command(
            'powersoftau',
            'Run built-in powersoftau command directly',
            (yargs) => {
                return yargs.help(false).version(false)
            },
        )
        .demandCommand(1, 'You must specify a command.')
        .strictCommands()
        .help().argv

    logger.info('invoked with args %o', args)

    const mode = args._[0]
    let powersoftauTmpFile
    if (!args.command) {
        powersoftauTmpFile = await extractPowersoftau()
        args.command = powersoftauTmpFile.name
        logger.info(`using built-in powersoftau at ${args.command}`)
    }

    try {
        if (mode === 'contribute') {
            await contribute(args)
        } else if (mode === 'verify') {
            await verify(args)
        } else if (mode === 'new') {
            await newChallenge(args)
        } else {
            logger.error(`Unexpected mode ${mode}`)
            process.exit(1)
        }
    } catch (err) {
        logger.error(err)
        process.exit(1)
    }

    process.exit(0)
}

main()
