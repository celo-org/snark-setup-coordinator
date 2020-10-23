import {
    ReadonlyCeremony,
    Ceremony,
    CeremonyParameters,
    ChunkDownloadInfo,
    ChunkInfo,
    ChunkData,
    LockedChunkData,
} from './ceremony'

export interface Coordinator {
    getCeremony(): ReadonlyCeremony
    setCeremony(ceremony: Ceremony): void
    getParameters(): CeremonyParameters
    getContributorChunks(participantId: string): ChunkInfo[]
    getVerifierChunks(): ChunkInfo[]
    getChunk(chunkId: string): LockedChunkData
    getChunkDownloadInfo(chunkId: string): ChunkDownloadInfo
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
