export interface ChunkContribution {
    location: string
    participantId: string
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
}
