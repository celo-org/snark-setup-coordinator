import fs from 'fs'
import clonedeep = require('clone-deep')

import { Coordinator, ChunkInfo, ChunkDownloadInfo } from './coordinator'
import {
    Attestation,
    Ceremony,
    CeremonyParameters,
    ChunkData,
    LockedChunkData,
    ReadonlyCeremony,
} from './ceremony'
import { isContributorData } from './contribution-data'
import { isVerificationData } from './verification-data'
import { logger } from './logger'

function timestamp(): string {
    return new Date().toISOString()
}

function isVerified({ contributions }: ChunkData): boolean {
    return contributions.every((a) => a.verified)
}

function hasContributed(id: string, { contributions }: ChunkData): boolean {
    return contributions.some((a) => a.contributorId == id)
}

export class DiskCoordinator implements Coordinator {
    dbPath: string
    db: Ceremony

    static init({
        config,
        dbPath,
        initialVerifiers = null,
        force = false,
    }: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: any
        dbPath: string
        initialVerifiers?: string[]
        force?: boolean
    }): void {
        const configVersion =
            typeof config.version === 'undefined' ? 0 : config.version
        if (!force && fs.existsSync(dbPath)) {
            const ceremony = JSON.parse(fs.readFileSync(dbPath).toString())
            if (ceremony.version >= configVersion) {
                return
            }
        }

        config = JSON.parse(JSON.stringify(config))
        if (!config.verifierIds) {
            config.verifierIds = []
        }
        if (!config.attestations) {
            config.attestations = []
        }
        if (initialVerifiers) {
            config.verifierIds = config.verifierIds.concat(initialVerifiers)
        }
        logger.info('args %o', initialVerifiers)
        logger.info('config %o', config.verifierIds)

        // Add parameters if they're falsy in the config
        config.parameters = config.parameters || {
            provingSystem: 'groth16',
            curveKind: 'bw6',
            batchSize: 64,
            chunkSize: 512,
            power: 10,
        }

        // Add metadata fields if they're missing.
        for (const lockedChunk of config.chunks) {
            lockedChunk.metadata = lockedChunk.metadata ?? {
                lockHolderTime: null,
            }
            for (const contribution of lockedChunk.contributions) {
                contribution.metadata = contribution.metadata ?? {
                    contributedTime: null,
                    contributedLockHolderTime: null,
                    contributedData: null,
                    verifiedTime: null,
                    verifiedLockHolderTime: null,
                    verifiedData: null,
                }
            }
        }

        fs.writeFileSync(dbPath, JSON.stringify(config, null, 2))
    }

    constructor({ dbPath }: { dbPath: string }) {
        this.dbPath = dbPath
        this.db = JSON.parse(fs.readFileSync(this.dbPath).toString())
    }

    _writeDb(): void {
        this.db.version += 1
        fs.writeFileSync(this.dbPath, JSON.stringify(this.db, null, 2))
    }

    getCeremony(): ReadonlyCeremony {
        return this.db
    }

    getParameters(): CeremonyParameters {
        return clonedeep(this.db.parameters)
    }

    getNumNonContributedChunks(contributorId: string): number {
        const ceremony = this.db
        return ceremony.chunks.filter((a) => !hasContributed(contributorId, a))
            .length
    }

    getLockedChunks(contributorId: string): string[] {
        const ceremony = this.db
        return ceremony.chunks
            .filter((a) => a.lockHolder == contributorId)
            .map(({ chunkId }) => chunkId)
    }

    getPhase(): string {
	return this.db.phase
    }

    addAttestation(att: Attestation, participantId: string): void {
        if (att.address != participantId) {
            throw new Error('adding attestation to wrong participant')
        }
        const ceremony = this.db
        if (!ceremony.attestations) {
            ceremony.attestations = []
        }
        if (!ceremony.attestations.some((a) => a.address == participantId)) {
            ceremony.attestations.push(att)
            this._writeDb()
        }
    }

    getContributorChunks(contributorId: string): ChunkInfo[] {
        const ceremony = this.db
        return ceremony.chunks
            .filter((a) => !hasContributed(contributorId, a) && isVerified(a))
            .map(({ lockHolder, chunkId }) => {
                return {
                    lockHolder,
                    chunkId,
                }
            })
    }

    getVerifierChunks(): ChunkInfo[] {
        const ceremony = this.db
        return ceremony.chunks
            .filter((a) => !isVerified(a))
            .map(({ lockHolder, chunkId }) => {
                return {
                    lockHolder,
                    chunkId,
                }
            })
    }

    getNumChunks(): number {
        return this.db.chunks.length
    }

    getMaxLocks(): number {
        return this.db.maxLocks
    }

    getShutdownSignal(): boolean {
        return this.db.shutdownSignal
    }

    setShutdownSignal(signal: boolean): void {
        this.db.shutdownSignal = signal
        this._writeDb()
    }

    static _getChunk(ceremony: Ceremony, chunkId: string): LockedChunkData {
        const chunk = ceremony.chunks.find((chunk) => chunk.chunkId == chunkId)
        if (!chunk) {
            throw new Error(`Unknown chunkId ${chunkId}`)
        }
        return chunk
    }

    setCeremony(newCeremony: Ceremony): void {
        if (this.db.version !== newCeremony.version) {
            throw new Error(
                `New ceremony is out of date: ${this.db.version} vs ${newCeremony.version}`,
            )
        }
        this.db = clonedeep(newCeremony)
        this._writeDb()
    }

    getChunk(chunkId: string): LockedChunkData {
        return clonedeep(DiskCoordinator._getChunk(this.db, chunkId))
    }

    getChunkDownloadInfo(chunkId: string): ChunkDownloadInfo {
        const { lockHolder, contributions } = DiskCoordinator._getChunk(
            this.db,
            chunkId,
        )
        return {
            chunkId,
            lockHolder,
            lastResponseUrl:
                contributions.length > 0
                    ? contributions[contributions.length - 1]
                          .contributedLocation
                    : null,
            lastChallengeUrl:
                contributions.length > 0
                    ? contributions[contributions.length - 1].verifiedLocation
                    : null,
            previousChallengeUrl:
                contributions.length > 1
                    ? contributions[contributions.length - 2].verifiedLocation
                    : null,
        }
    }

    tryLockChunk(chunkId: string, participantId: string): boolean {
        const chunk = DiskCoordinator._getChunk(this.db, chunkId)
        if (chunk.lockHolder) {
            if (chunk.lockHolder == participantId) {
                return false
            } else {
                throw new Error(
                    `${participantId} can't lock chunk ${chunkId} since it's already locked by ${chunk.lockHolder}`,
                )
            }
        }

        const holding = this.db.chunks.filter(
            (chunk) => chunk.lockHolder === participantId,
        )
        if (holding.length >= this.db.maxLocks) {
            throw new Error(
                `${participantId} already holds too many locks (${holding.length}) on chunk ${chunkId}`,
            )
        }

        //
        // Return false if contributor trying to lock unverified chunk or
        // if verifier trying to lock verified chunk.
        // Also return false if contributor has already contributed
        // to the chunk.
        const verifier = this.db.verifierIds.includes(participantId)
        if (!verifier && hasContributed(participantId, chunk)) {
            throw new Error(
                `${participantId} can't lock chunk ${chunkId} since they already contributed to it`,
            )
        }
        const lastContribution =
            chunk.contributions[chunk.contributions.length - 1]
        if (lastContribution.verified === verifier) {
            throw new Error(
                `${participantId} can't lock chunk ${chunkId} since it's either verified and they're a verifier or it's unverified and they're a contributor`,
            )
        }

        chunk.lockHolder = participantId
        chunk.metadata.lockHolderTime = timestamp()
        this._writeDb()
        return true
    }

    tryUnlockChunk(chunkId: string, participantId: string): boolean {
        const chunk = DiskCoordinator._getChunk(this.db, chunkId)
        if (chunk.lockHolder !== participantId) {
            throw new Error(
                `${participantId} does not hold lock on chunk ${chunkId}`,
            )
        }

        chunk.lockHolder = null
        chunk.metadata.lockHolderTime = timestamp()
        this._writeDb()
        return true
    }

    async contributeChunk({
        chunkId,
        participantId,
        location,
        signedData,
    }: {
        chunkId: string
        participantId: string
        location: string
        signedData: object
    }): Promise<void> {
        const chunk = DiskCoordinator._getChunk(this.db, chunkId)
        if (chunk.lockHolder !== participantId) {
            throw new Error(
                `Participant ${participantId} does not hold lock ` +
                    `on chunk ${chunkId}`,
            )
        }
        const now = timestamp()
        const verifier = this.db.verifierIds.includes(participantId)
        if (verifier) {
            if (!isVerificationData(signedData)) {
                throw new Error(
                    `Data for chunk ${chunkId} by participant ${participantId} is not valid verification data: ${JSON.stringify(
                        signedData,
                    )}`,
                )
            }
            const contribution =
                chunk.contributions[chunk.contributions.length - 1]
            const contributorSignedData = contribution.contributedData
            if (!isContributorData(contributorSignedData)) {
                throw new Error(
                    `Data for chunk ${chunkId} by participant ${participantId} during verification is not valid contributor data: ${JSON.stringify(
                        contributorSignedData,
                    )}`,
                )
            }
            if (
                contributorSignedData.data.challengeHash !==
                signedData.data.challengeHash
            ) {
                throw new Error(
                    `During verification for chunk ${chunkId} by participant ${participantId}, contribution and verification challenge hashes were different: ${contributorSignedData.data.challengeHash} != ${signedData.data.challengeHash}`,
                )
            }
            if (
                contributorSignedData.data.responseHash !==
                signedData.data.responseHash
            ) {
                throw new Error(
                    `During verification for chunk ${chunkId} by participant ${participantId}, contribution and verification response hashes were different: ${contributorSignedData.data.responseHash} != ${signedData.data.responseHash}`,
                )
            }
            contribution.verifierId = participantId
            contribution.verifiedLocation = location
            contribution.verified = true
            contribution.verifiedData = signedData
            contribution.metadata.verifiedTime = now
            contribution.metadata.verifiedLockHolderTime =
                chunk.metadata.lockHolderTime
        } else {
            if (!isContributorData(signedData)) {
                throw new Error(
                    `Data for chunk ${chunkId} by participant ${participantId} is not valid contributor data: ${JSON.stringify(
                        signedData,
                    )}`,
                )
            }
            const previousContribution =
                chunk.contributions[chunk.contributions.length - 1]
            const previousVerificationSignedData =
                previousContribution.verifiedData
            if (!isVerificationData(previousVerificationSignedData)) {
                throw new Error(
                    `During contribution for chunk ${chunkId} by participant ${participantId}, data is not valid verification data: ${JSON.stringify(
                        signedData,
                    )}`,
                )
            }
            if (
                signedData.data.challengeHash !==
                previousVerificationSignedData.data.newChallengeHash
            ) {
                throw new Error(
                    `During contribution for chunk ${chunkId} by participant ${participantId}, contribution and verification challenge hashes were different: ${signedData.data.challengeHash} != ${previousVerificationSignedData.data.newChallengeHash}`,
                )
            }
            chunk.contributions.push({
                metadata: {
                    contributedTime: now,
                    contributedLockHolderTime: chunk.metadata.lockHolderTime,
                    verifiedTime: null,
                    verifiedLockHolderTime: null,
                },
                contributorId: participantId,
                contributedLocation: location,
                contributedData: signedData,
                verifierId: null,
                verifiedLocation: null,
                verified: false,
                verifiedData: null,
            })
        }
        chunk.lockHolder = null
        chunk.metadata.lockHolderTime = now
        this._writeDb()
    }

    getRound(): number {
        return this.db.round
    }
}
