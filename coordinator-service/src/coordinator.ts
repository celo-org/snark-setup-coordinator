import {
    ReadonlyCeremony,
    Ceremony,
    CeremonyParameters,
    ChunkData,
    LockedChunkData,
    Attestation,
} from './ceremony'

export interface ChunkInfo {
    chunkId: string
    lockHolder: string
}

export interface ChunkDownloadInfo {
    chunkId: string
    lockHolder: string
    lastResponseUrl: string
    lastChallengeUrl: string
    previousChallengeUrl: string
}

export interface Coordinator {
    getCeremony(): ReadonlyCeremony
    setCeremony(ceremony: Ceremony): void
    getParameters(): CeremonyParameters
    getNumNonContributedChunks(contributorId: string): number
    getLockedChunks(participantId: string): string[]
    addAttestation(attest: Attestation, participantId: string): void
    getContributorChunks(participantId: string): ChunkInfo[]
    getVerifierChunks(): ChunkInfo[]
    getNumChunks(): number
    getMaxLocks(): number
    getShutdownSignal(): boolean
    setShutdownSignal(signal: boolean): void
    getRound(): number
    getChunk(chunkId: string): LockedChunkData
    getChunkDownloadInfo(chunkId: string): ChunkDownloadInfo
    tryLockChunk(chunkId: string, participantId: string): boolean
    tryUnlockChunk(chunkId: string, participantId: string): boolean
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
        round,
        chunk,
        participantId,
    }: {
        round: number
        chunk: ChunkData
        participantId: string
    })

    copyChunk({
        round,
        chunk,
        participantId,
    }: {
        round: number
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
