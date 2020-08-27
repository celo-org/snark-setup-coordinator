export interface ChunkContribution {
    location: string
    participantId: string
    verified: boolean
}

export interface ChunkData {
    chunkId: string
    contributions: ChunkContribution[]
}

export interface LockedChunkData extends ChunkData {
    holder: string
}

export interface Ceremony {
    chunks: LockedChunkData[]
    participantIds: string[]
    verifierIds: string[]
    version: number
}

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
