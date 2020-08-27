import { ChunkStorage } from './coordinator'
import fs from 'fs'
import path from 'path'

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
        chunkId,
        participantId, // eslint-disable-line @typescript-eslint/no-unused-vars
        version,
    }: {
        chunkId: string
        participantId: string
        version: string
    }): string {
        const path = `/${chunkId}/contribution/${version}`
        return `${this.chunkStorageUrl}${path}`
    }

    getChunkReadLocation({
        chunkId,
        participantId,
        version,
    }: {
        chunkId: string
        participantId: string
        version: string
    }): string {
        // It's the same as the write location.
        return this.getChunkWriteLocation({ chunkId, participantId, version })
    }

    setChunk(chunkId: string, version: string, content: string): void {
        const contentPath = path.join(this.storagePath, `${chunkId}.${version}`)
        fs.writeFileSync(contentPath, content)
    }

    getChunk(chunkId: string, version: string): string {
        const contentPath = path.join(this.storagePath, `${chunkId}.${version}`)
        return fs.readFileSync(contentPath).toString()
    }
}
