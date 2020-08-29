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

export class ShellVerifier implements ShellCommand {
    contributorCommand: string
    chunkData: ChunkData
    challengeFile: tmp.FileResult
    contributionFile: tmp.FileResult
    responseFile: tmp.FileResult

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

        const subprocess = execa(this.contributorCommand, [
            chunkIndex,
            this.contributionFile.name,
            this.challengeFile.name,
            this.responseFile.name,
        ])
        subprocess.stdout.pipe(process.stdout)
        subprocess.stderr.pipe(process.stderr)
        await subprocess

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
export class ShellContributor implements ShellCommand {
    contributorCommand: string
    chunkData: ChunkData
    challengeFile: tmp.FileResult
    contributionFile: tmp.FileResult

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

        const subprocess = execa(this.contributorCommand, [
            chunkIndex,
            this.contributionFile.name,
            this.challengeFile.name,
        ])
        subprocess.stdout.pipe(process.stdout)
        subprocess.stderr.pipe(process.stderr)
        await subprocess

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
