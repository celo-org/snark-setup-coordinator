import axios from 'axios'
import execa = require('execa')
import fs from 'fs'
import tmp from 'tmp'

import { ChunkData } from './ceremony'

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

export interface ShellCommand {
    load(): Promise<void>
    run(): Promise<string>
    cleanup(): void
}

abstract class Powersoftau implements ShellCommand {
    contributorCommand: string
    chunkData: ChunkData

    curveKind = 'bw6'
    batchSize = 64
    chunkSize = 512
    power = 10
    seed: string

    constructor({
        chunkData,
        contributorCommand,
    }: {
        chunkData: ChunkData
        contributorCommand: string
    }) {
        this.chunkData = chunkData
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
            '--seed',
            this.seed,
        ]

        const subprocess = execa(this.contributorCommand, [
            ...baseArgs,
            ...args,
        ])

        subprocess.stdout.pipe(process.stdout)
        subprocess.stderr.pipe(process.stderr)
        return subprocess
    }

    abstract load(): Promise<void>
    abstract run(): Promise<string>
    abstract cleanup(): void
}

export class ShellVerifier extends Powersoftau {
    challengeFile: tmp.FileResult
    contributionFile: tmp.FileResult
    responseFile: tmp.FileResult

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
        this.contributionFile = tmp.fileSync({ discardDescriptor: true })
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
            this.contributionFile.name,
        )
        return this.contributionFile.name
    }

    // It isn't necessary to call this, but seems prudent to help keep disk
    // space overhead low.
    cleanup(): void {
        const toCleanup = ['challengeFile', 'contributionFile', 'responseFile']
        for (const property of toCleanup) {
            const fileToCleanup = this[property]
            if (fileToCleanup) {
                fileToCleanup.removeCallback()
                this[property] = null
            }
        }
    }
}

// Run a command to generate a contribution.
export class ShellContributor extends Powersoftau {
    challengeFile: tmp.FileResult
    contributionFile: tmp.FileResult

    async load(): Promise<void> {
        const challengeContribution = this.chunkData.contributions[
            this.chunkData.contributions.length - 1
        ]
        const challengeUrl = challengeContribution.verifiedLocation
        const challengeFile = await fetch({ url: challengeUrl })

        this.challengeFile = challengeFile
    }

    async run(): Promise<string> {
        this.contributionFile = tmp.fileSync({ discardDescriptor: true })
        const chunkIndex = this.chunkData.chunkId
        await this._exec(
            '--chunk-index',
            chunkIndex,
            'contribute',
            '--challenge-fname',
            this.challengeFile.name,
            '--response-fname',
            this.contributionFile.name,
        )
        return this.contributionFile.name
    }

    // It isn't necessary to call this, but seems prudent to help keep disk
    // space overhead low.
    cleanup(): void {
        if (this.challengeFile) {
            this.challengeFile.removeCallback()
            this.challengeFile = null
        }
        if (this.contributionFile) {
            this.contributionFile.removeCallback()
            this.contributionFile = null
        }
    }
}
