import { Ceremony, ChunkData, LockedChunkData } from './ceremony'

export interface Coordinator {
    getCeremony(): Ceremony
    setCeremony(ceremony: Ceremony): void
    getChunk(chunkId: string): LockedChunkData
    tryLockChunk(chunkId: string, particpantId: string): boolean
    tryUnlockChunk(chunkId: string, particpantId: string): boolean
    contributeChunk({
        chunkId,
        participantId,
        location,
        signedData,
    }: {
        chunkId: string
        participantId: string
        location: string
        signedData: object
    }): Promise<void>
}

export interface ChunkStorage {
    getChunkWriteLocation({
        chunk,
        participantId,
    }: {
        chunk: ChunkData
        participantId: string
    })

    copyChunk({
        chunk,
        participantId,
    }: {
        chunk: ChunkData
        participantId: string
    }): Promise<string>
}

export function chunkVersion(chunk: ChunkData): number {
    // Generate an number that uniquely identifies the current state of the chunk
    return (
        chunk.contributions.filter((contribution) => contribution.contributorId)
            .length +
        chunk.contributions.filter((contribution) => contribution.verifierId)
            .length
    )
}
