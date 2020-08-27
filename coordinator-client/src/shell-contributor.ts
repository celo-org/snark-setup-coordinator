import axios from 'axios'
import execa = require('execa')
import fs from 'fs'
import tmp from 'tmp'

import { ChunkData } from './coordinator'

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

// Run a command to generate a contribution.
export class ShellContributor {
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
        const challengeUrl = challengeContribution.location
        const challengeFile = await fetch({ url: challengeUrl })

        this.challengeFile = challengeFile
    }

    async run(): Promise<string> {
        this.contributionFile = tmp.fileSync({ discardDescriptor: true })

        // TODO: what's the value of chunkIndex?
        const chunkIndex = '0'

        const subprocess = execa(this.contributorCommand, [
            this.chunkData.chunkId,
            chunkIndex,
            this.contributionFile.name,
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
