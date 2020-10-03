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
    lockHolder: string
}

export interface CeremonyParameters {
    provingSystem?: string
    curveKind?: string
    chunkSize?: number
    batchSize?: number
    power?: number
}

export interface Ceremony {
    parameters: CeremonyParameters
    chunks: LockedChunkData[]
    contributorIds: string[]
    verifierIds: string[]
    version: number
}
