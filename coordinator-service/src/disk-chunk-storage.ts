import { ChunkStorage } from './coordinator'
import fs from 'fs'
import path from 'path'

export class DiskChunkStorage implements ChunkStorage {
    storagePath: string

    constructor(storagePath: string) {
        this.storagePath = storagePath
    }

    async setChunk(
        chunkId: string,
        particpantId: string,
        content: string,
    ): Promise<string> {
        const contentPath = path.join(
            this.storagePath,
            `${chunkId}-${particpantId}`,
        )
        fs.writeFileSync(contentPath, content)
        return contentPath
    }
}
