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
        chunk,
        participantId, // eslint-disable-line @typescript-eslint/no-unused-vars
    }: {
        chunk: ChunkData
        participantId: string
    }): string {
        const chunkId = chunk.chunkId
        const version = chunkVersion(chunk)
        const path = `/${chunkId}/contribution/${version}`
        return `${this.chunkStorageUrl}${path}`
    }

    async copyChunk({
        chunk,
        participantId,
    }: {
        chunk: ChunkData
        participantId: string
    }): Promise<string> {
        // It's the same as the write location.
        return this.getChunkWriteLocation({ chunk, participantId })
    }

    setChunk(chunkId: string, version: string, content: Buffer): void {
        const contentPath = path.join(this.storagePath, `${chunkId}.${version}`)
        fs.writeFileSync(contentPath, content)
    }

    getChunk(chunkId: string, version: string): Buffer {
        const contentPath = path.join(this.storagePath, `${chunkId}.${version}`)
        return fs.readFileSync(contentPath)
    }
}
