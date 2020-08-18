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
}

export interface Coordinator {
    getCeremony(): Ceremony
    tryLockChunk(chunkId: string, particpantId: string): boolean
    contributeChunk(
        chunkId: string,
        participantId: string,
        content: string,
    ): Promise<void>
}

export interface ChunkStorage {
    setChunk(
        chunkId: string,
        particpantId: string,
        content: string,
    ): Promise<string>
}
