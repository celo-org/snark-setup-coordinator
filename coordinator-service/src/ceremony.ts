export interface ChunkContributionMetadata {
    contributedTime: string
    contributedLockHolderTime: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contributedData: any
    verifiedTime: string
    verifiedLockHolderTime: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    verifiedData: any
}

export interface ChunkContribution {
    metadata: ChunkContributionMetadata

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

export interface LockedChunkDataMetadata {
    lockHolderTime: string
}

export interface LockedChunkData extends ChunkData {
    metadata: LockedChunkDataMetadata

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
