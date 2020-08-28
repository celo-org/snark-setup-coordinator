import { Ceremony, LockedChunkData } from './ceremony'

export interface Coordinator {
    getCeremony(): Ceremony
    getChunk(chunkId: string): LockedChunkData
    tryLockChunk(chunkId: string, particpantId: string): boolean
    contributeChunk(
        chunkId: string,
        participantId: string,
        location: string,
    ): Promise<void>
}

export interface ChunkStorage {
    getChunkWriteLocation({
        chunkId,
        participantId,
        version,
    }: {
        chunkId: string
        participantId: string
        version: string
    })

    getChunkReadLocation({
        chunkId,
        participantId,
        version,
    }: {
        chunkId: string
        participantId: string
        version: string
    })
}
