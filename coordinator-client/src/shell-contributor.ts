import execa = require('execa')
import * as path from 'path'

import { ChunkData } from './coordinator'

// Run a command to generate a contribution.
export class ShellContributor {
    contributorCommand: string
    contributionBasePath: string

    constructor({
        contributorCommand,
        contributionBasePath,
    }: {
        contributorCommand: string
        contributionBasePath: string
    }) {
        this.contributorCommand = contributorCommand
        this.contributionBasePath = contributionBasePath
    }

    async run(chunk: ChunkData): Promise<string> {
        const contributionPath = path.join(
            this.contributionBasePath,
            `${chunk.chunkId}.contribution`,
        )
        const subprocess = execa(this.contributorCommand, [
            chunk.chunkId,
            contributionPath,
        ])
        subprocess.stdout.pipe(process.stdout)
        subprocess.stderr.pipe(process.stderr)
        await subprocess
        return contributionPath
    }
}
