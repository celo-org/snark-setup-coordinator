import fs from 'fs'
import path from 'path'

import { ChunkStorage, chunkVersion } from './coordinator'
import { ChunkData } from './ceremony'

export class DiskChunkStorage implements ChunkStorage {
    chunkStorageUrl: string
    storagePath: string

    constructor({
        storagePath,
        chunkStorageUrl,
    }: {
        storagePath: string
        chunkStorageUrl: string
    }) {
        this.storagePath = storagePath
        this.chunkStorageUrl = chunkStorageUrl
    }

    getChunkWriteLocation({
        round,
        chunk,
        participantId, // eslint-disable-line @typescript-eslint/no-unused-vars
    }: {
        round: number
        chunk: ChunkData
        participantId: string
    }): string {
        const chunkId = chunk.chunkId
        const version = chunkVersion(chunk)
        const path = `/${round}/${chunkId}/contribution/${version}`
        return `${this.chunkStorageUrl}${path}`
    }

    async copyChunk({
        round,
        chunk,
        participantId,
    }: {
        round: number
        chunk: ChunkData
        participantId: string
    }): Promise<string> {
        // It's the same as the write location.
        return this.getChunkWriteLocation({ round, chunk, participantId })
    }

    setChunk(
        round: number,
        chunkId: string,
        version: string,
        content: Buffer,
    ): void {
        const contentPath = path.join(
            this.storagePath,
            `${round}.${chunkId}.${version}`,
        )
        fs.writeFileSync(contentPath, content)
    }

    getChunk(round: number, chunkId: string, version: string): Buffer {
        const contentPath = path.join(
            this.storagePath,
            `${round}.${chunkId}.${version}`,
        )
        return fs.readFileSync(contentPath)
    }
}
