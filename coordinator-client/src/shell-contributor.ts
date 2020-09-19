import axios from 'axios'
import execa = require('execa')
import fs from 'fs'
import path from 'path'
import os from 'os'
import tmp from 'tmp'

import { ChunkData } from './ceremony'
import { logger } from './logger'

export interface ShellCommand {
    load(): Promise<void>
    run(): Promise<string>
    cleanup(): void
}

function copy(source, target): Promise<unknown> {
    const reader = fs.createReadStream(source)
    const writer = fs.createWriteStream(target)
    const finish = new Promise((resolve) => writer.on('close', resolve))
    reader.pipe(writer)
    return finish
}

export async function extractPowersoftau(): Promise<tmp.FileResult> {
    const powersoftauFileName = {
        Linux: 'powersoftau_linux_musl.file',
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
        prefix: 'powersoftau-extracted',
        discardDescriptor: true,
    })
    await copy(powersoftauPath, tmpFile.name)

    return tmpFile
}

async function fetch({ url }: { url: string }): Promise<tmp.FileResult> {
    const destinationFile = tmp.fileSync({ discardDescriptor: true })
    const writer = fs.createWriteStream(destinationFile.name)
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
    })
    response.data.pipe(writer)

    await new Promise((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
    })

    return destinationFile
}

function forceUnlink(filePath): void {
    try {
        fs.unlinkSync(filePath)
    } catch (err) {
        if (err.code !== 'ENOENT') {
            throw err
        }
    }
}

abstract class Powersoftau {
    contributorCommand: string
    chunkData: ChunkData

    curveKind = 'bw6'
    batchSize = 64
    chunkSize = 512
    power = 10

    constructor({ contributorCommand }: { contributorCommand: string }) {
        this.contributorCommand = contributorCommand
    }

    _exec(...args: string[]): execa.ExecaChildProcess {
        const baseArgs = [
            '--curve-kind',
            this.curveKind,
            '--batch-size',
            this.batchSize.toString(),
            '--contribution-mode',
            'chunked',
            '--chunk-size',
            this.chunkSize.toString(),
            '--power',
            this.power.toString(),
        ]

        const powersoftauArgs = [...baseArgs, ...args]

        logger.info([this.contributorCommand, ...powersoftauArgs].join(' '))
        const subprocess = execa(this.contributorCommand, powersoftauArgs)

        subprocess.stdout.pipe(process.stdout)
        subprocess.stderr.pipe(process.stderr)
        return subprocess
    }
}

export class PowersoftauNew extends Powersoftau {
    seedFile: string

    constructor({
        seedFile,
        contributorCommand,
    }: {
        seedFile: string
        contributorCommand: string
    }) {
        super({ contributorCommand })
        this.seedFile = seedFile
    }

    async run({
        chunkIndex,
        contributionPath,
    }: {
        chunkIndex: number
        contributionPath: string
    }): Promise<void> {
        await this._exec(
            '--seed',
            this.seedFile,
            '--chunk-index',
            chunkIndex.toString(),
            'new',
            '--challenge-fname',
            contributionPath,
        )
    }
}

export class ShellVerifier extends Powersoftau implements ShellCommand {
    challengeFile: tmp.FileResult
    responseFile: tmp.FileResult
    contributionFileName: string

    constructor({
        chunkData,
        contributorCommand,
    }: {
        chunkData: ChunkData
        contributorCommand: string
    }) {
        super({ contributorCommand })
        this.chunkData = chunkData
    }

    async load(): Promise<void> {
        const challengeContribution = this.chunkData.contributions[
            this.chunkData.contributions.length - 2
        ]
        const challengeUrl = challengeContribution.verifiedLocation
        const challengeFile = await fetch({ url: challengeUrl })

        const responseContribution = this.chunkData.contributions[
            this.chunkData.contributions.length - 1
        ]
        const responseUrl = responseContribution.contributedLocation
        const responseFile = await fetch({ url: responseUrl })

        this.challengeFile = challengeFile
        this.responseFile = responseFile
    }

    async run(): Promise<string> {
        this.contributionFileName = tmp.tmpNameSync()
        const chunkIndex = this.chunkData.chunkId
        await this._exec(
            '--chunk-index',
            chunkIndex,
            'verify-and-transform-pok-and-correctness',
            '--challenge-fname',
            this.challengeFile.name,
            '--response-fname',
            this.responseFile.name,
            '--new-challenge-fname',
            this.contributionFileName,
        )
        return this.contributionFileName
    }

    // It isn't necessary to call this, but seems prudent to help keep disk
    // space overhead low.
    cleanup(): void {
        const toCleanup = ['challengeFile', 'responseFile']
        for (const property of toCleanup) {
            const fileToCleanup = this[property]
            if (fileToCleanup) {
                fileToCleanup.removeCallback()
                this[property] = null
            }
        }
        if (this.contributionFileName) {
            forceUnlink(this.contributionFileName)
            this.contributionFileName = null
        }
    }
}

// Run a command to generate a contribution.
export class ShellContributor extends Powersoftau implements ShellCommand {
    challengeFile: tmp.FileResult
    contributionFileName: string
    seedFile: string

    constructor({
        chunkData,
        contributorCommand,
        seedFile,
    }: {
        chunkData: ChunkData
        contributorCommand: string
        seedFile: string
    }) {
        super({ contributorCommand })
        this.seedFile = seedFile
        this.chunkData = chunkData
    }

    async load(): Promise<void> {
        const challengeContribution = this.chunkData.contributions[
            this.chunkData.contributions.length - 1
        ]
        const challengeUrl = challengeContribution.verifiedLocation
        const challengeFile = await fetch({ url: challengeUrl })

        this.challengeFile = challengeFile
    }

    async run(): Promise<string> {
        this.contributionFileName = tmp.tmpNameSync()
        const chunkIndex = this.chunkData.chunkId
        await this._exec(
            '--seed',
            this.seedFile,
            '--chunk-index',
            chunkIndex,
            'contribute',
            '--challenge-fname',
            this.challengeFile.name,
            '--response-fname',
            this.contributionFileName,
        )
        return this.contributionFileName
    }

    // It isn't necessary to call this, but seems prudent to help keep disk
    // space overhead low.
    cleanup(): void {
        if (this.challengeFile) {
            this.challengeFile.removeCallback()
            this.challengeFile = null
        }
        if (this.contributionFileName) {
            forceUnlink(this.contributionFileName)
            this.contributionFileName = null
        }
    }
}
