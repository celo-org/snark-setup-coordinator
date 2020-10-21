import axios, { Method } from 'axios'
import dotenv from 'dotenv'
import execa = require('execa')
import fs from 'fs'
import yargs = require('yargs')
import tmp from 'tmp'

import { logger } from './logger'
import {
    extractPowersoftau,
    PowersoftauNew,
    ShellContributor,
    ShellVerifier,
} from './shell-contributor'
import { CeremonyContributor, CeremonyVerifier } from './ceremony-participant'
import { LockedChunkData, ChunkData, CeremonyParameters } from './ceremony'
import { DefaultChunkUploader } from './chunk-uploader'
import { AuthCelo } from './auth-celo'
import { AuthDummy } from './auth-dummy'
import { worker } from './worker'
import { Auth } from './auth'

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

async function contribute({
    participantId,
    apiUrl,
    auth,
    command,
    seedFile,
}: {
    participantId: string
    apiUrl: string
    auth: Auth
    command: string
    seedFile: string
}): Promise<void> {
    const chunkUploader = new DefaultChunkUploader({ auth: auth })
    const client = new CeremonyContributor({
        auth,
        participantId,
        baseUrl: apiUrl,
        chunkUploader,
    })
    const contributor = (
        parameters: CeremonyParameters,
        chunkData: ChunkData,
    ): ShellContributor => {
        return new ShellContributor({
            parameters,
            chunkData,
            contributorCommand: command,
            seedFile: seedFile,
        })
    }

    await worker({ client, contributor })
}

async function verify({
    participantId,
    apiUrl,
    auth,
    command,
}: {
    participantId: string
    apiUrl: string
    auth: Auth
    command: string
}): Promise<void> {
    const chunkUploader = new DefaultChunkUploader({ auth })
    const client = new CeremonyVerifier({
        auth,
        participantId,
        baseUrl: apiUrl,
        chunkUploader,
    })

    const contributor = (
        parameters: CeremonyParameters,
        chunkData: ChunkData,
    ): ShellVerifier => {
        return new ShellVerifier({
            parameters,
            chunkData,
            contributorCommand: command,
        })
    }

    await worker({ client, contributor })
}

async function newChallenge({
    participantId,
    apiUrl,
    auth,
    command,
    seedFile,
    count,
}: {
    participantId: string
    apiUrl: string
    auth: Auth
    command: string
    seedFile: string
    count: number
}): Promise<void> {
    const chunkUploader = new DefaultChunkUploader({ auth })
    const client = new CeremonyContributor({
        auth,
        participantId,
        baseUrl: apiUrl,
        chunkUploader,
    })
    const ceremony = await client.getCeremony()

    const powersoftauNew = new PowersoftauNew({
        parameters: ceremony.parameters,
        contributorCommand: command,
        seedFile: seedFile,
    })

    const chunks = []
    for (let chunkIndex = 0; chunkIndex < count; chunkIndex++) {
        logger.info(`creating challenge ${chunkIndex + 1} of ${count}`)
        const contributionPath = tmp.tmpNameSync()
        const newChallengeHashPath = tmp.tmpNameSync()
        await powersoftauNew.run({
            chunkIndex,
            contributionPath,
            newChallengeHashPath,
        })
        const newChallengeHash = fs
            .readFileSync(newChallengeHashPath)
            .toString('hex')

        const url = `${apiUrl}/chunks/${chunkIndex}/contribution/0`
        await chunkUploader.upload({
            url,
            content: fs.readFileSync(contributionPath),
        })
        logger.info('uploaded %s', url)
        logger.info('hash for chunk %d: %s', chunkIndex, newChallengeHash)

        fs.unlinkSync(contributionPath)
        fs.unlinkSync(newChallengeHashPath)
        const chunk: LockedChunkData = {
            chunkId: chunkIndex.toString(),
            lockHolder: null,
            contributions: [
                {
                    contributorId: null,
                    contributedLocation: null,
                    verifierId: participantId,
                    verifiedLocation: url,
                    verified: true,
                    verifiedData: {
                        data: {
                            challengeHash:
                                '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            responseHash:
                                '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            newChallengeHash,
                        },
                        signature:
                            '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                    },
                    metadata: {
                        contributedTime: null,
                        contributedLockHolderTime: null,
                        verifiedTime: null,
                        verifiedLockHolderTime: null,
                    },
                    contributedData: null,
                },
            ],
            metadata: {
                lockHolderTime: null,
            },
        }
        chunks.push(chunk)
    }
    logger.info('new chunks: %s', JSON.stringify(chunks, null, 2))
}

async function httpAuth({
    auth,
    method,
    path,
}: {
    auth: Auth
    method: string
    path: string
}): Promise<void> {
    process.stdout.write(
        auth.getAuthorizationValue({
            method: method,
            path: path,
        }),
    )
}

async function ctl({
    apiUrl,
    auth,
    method,
    path,
    dataPath,
}: {
    apiUrl: string
    auth: Auth
    method: Method
    path: string
    dataPath: string
}): Promise<void> {
    const url = `${apiUrl.replace(/$\//, '')}/${path.replace(/^\//, '')}`
    let data
    if (dataPath) {
        data = JSON.parse(fs.readFileSync(dataPath).toString())
    }

    const result = await axios({
        method,
        url,
        data,
        headers: {
            Authorization: auth.getAuthorizationValue({
                method,
                path,
            }),
        },
    })
    if (result.headers['content-type'].includes('application/json')) {
        console.log(JSON.stringify(result.data, null, 2))
    } else {
        console.log(result.statusText)
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
    }

    const seedArgs = {
        'seed-file': {
            type: 'string',
            demand: true,
            describe:
                'Path to file containing 32-character hexadecimal seed value',
        },
    }

    const participateArgs = {
        'api-url': {
            default: 'http://localhost:8080',
            type: 'string',
            describe: 'Ceremony API url',
        },
        'auth-type': {
            choices: ['celo', 'dummy'],
            default: 'dummy',
            type: 'string',
        },
        'participant-id': {
            type: 'string',
            demand: true,
            describe: 'ID of ceremony participant',
        },
        'celo-private-key': {
            type: 'string',
            describe: 'Private key if using Celo auth (for development)',
        },
        'celo-private-key-file': {
            type: 'string',
            describe: 'Path to private key if using Celo auth',
        },
    }

    const args = yargs
        .env('COORDINATOR')
        .config('config', (configPath) => {
            dotenv.config({ path: configPath })
            return {}
        })
        .command('contribute', 'Run the process to make contributions', {
            ...participateArgs,
            ...powersoftauArgs,
            ...seedArgs,
        })
        .command('verify', 'Run the process to verify contributions', {
            ...participateArgs,
            ...powersoftauArgs,
        })
        .command('new', 'Create new challenges for a ceremony', {
            ...participateArgs,
            ...powersoftauArgs,
            count: {
                type: 'number',
                demand: true,
                describe: 'Number of challenges',
            },
        })
        .command('ctl', 'Control the coordinator-service', {
            ...participateArgs,
            method: {
                type: 'string',
                demand: true,
                describe: 'HTTP method',
            },
            path: {
                type: 'string',
                demand: true,
                describe: 'HTTP resource path',
            },
            data: {
                type: 'string',
                describe: 'JSON request body',
            },
        })
        .command('http-auth', 'Print Authorization header to stdout', {
            ...participateArgs,
            method: {
                type: 'string',
                demand: true,
                describe: 'HTTP method',
            },
            path: {
                type: 'string',
                demand: true,
                describe: 'HTTP resource path',
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

    logger.debug('invoked with args %o', args)

    const mode = args._[0]
    let powersoftauTmpFile
    if (!args.command) {
        powersoftauTmpFile = await extractPowersoftau()
        args.command = powersoftauTmpFile.name
        logger.debug(`using built-in powersoftau at ${args.command}`)
    }

    if (args.authType === 'celo') {
        let privateKey = args.celoPrivateKey
        if (!privateKey) {
            privateKey = fs.readFileSync(args.celoPrivateKeyFile).toString()
        }

        args.auth = new AuthCelo({
            address: args.participantId,
            privateKey,
        })
    } else {
        logger.debug("using dummy auth")
        args.auth = new AuthDummy(args.participantId)
    }

    try {
        if (mode === 'contribute') {
            await contribute(args)
        } else if (mode === 'verify') {
            await verify(args)
        } else if (mode === 'new') {
            await newChallenge(args)
        } else if (mode === 'http-auth') {
            await httpAuth(args)
        } else if (mode === 'ctl') {
            await ctl(args)
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
