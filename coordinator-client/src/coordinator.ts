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
