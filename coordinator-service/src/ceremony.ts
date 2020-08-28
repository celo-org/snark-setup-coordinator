export interface ChunkContribution {
    contributorId: string
    contributedLocation: string
    verifierId: string
    verifiedLocation: string
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
