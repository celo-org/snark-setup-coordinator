import fs from 'fs'
import clonedeep = require('clone-deep')

import { Coordinator } from './coordinator'
import {
    Ceremony,
    CeremonyParameters,
    ChunkInfo,
    ChunkDownloadInfo,
    LockedChunkData,
    ReadonlyCeremony,
} from './ceremony'
import { isContributorData } from './contribution-data'
import { isVerificationData } from './verification-data'

function timestamp(): string {
    return new Date().toISOString()
}

export class DiskCoordinator implements Coordinator {
    dbPath: string
    db: Ceremony

    static init({
        config,
        dbPath,
        force = false,
    }: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: any
        dbPath: string
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

    getContributorChunks(contributorId: string): ChunkInfo[] {
        const ceremony = this.db
        return ceremony.chunks.map(({ lockHolder, chunkId, contributions }) => {
            return {
                lockHolder,
                chunkId,
                contributed: contributions.some(
                    (a) => a.contributorId == contributorId,
                ),
            }
        })
    }

    getVerifierChunks(): ChunkInfo[] {
        const ceremony = this.db
        return ceremony.chunks.map(({ lockHolder, chunkId, contributions }) => {
            return {
                lockHolder,
                chunkId,
                contributed: contributions.every(
                    (a) => a.verified,
                ),
            }
        })
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
        const { lockHolder, contributions } = DiskCoordinator._getChunk(this.db, chunkId)
        return {
            chunkId,
            lockHolder,
            latestURL: contributions.length > 0 ? contributions[contributions.length-1].contributedLocation : null,
            previousURL: contributions.length > 1 ? contributions[contributions.length-2].contributedLocation : null,
        }
    }

    tryLockChunk(chunkId: string, participantId: string): boolean {
        const holding = this.db.chunks.filter(
            (chunk) => chunk.lockHolder === participantId,
        )
        if (holding.length >= this.db.maxLocks) {
            throw new Error(
                `${participantId} already holds too many locks (${holding.length}) on chunk ${chunkId}`,
            )
        }

        const chunk = DiskCoordinator._getChunk(this.db, chunkId)
        if (chunk.lockHolder) {
            return false
        }
        //
        // Return false if contributor trying to lock unverified chunk or
        // if verifier trying to lock verified chunk.
        //
        const verifier = this.db.verifierIds.includes(participantId)
        const lastContribution =
            chunk.contributions[chunk.contributions.length - 1]
        if (lastContribution.verified === verifier) {
            return false
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
                    `Data is not valid verification data: ${JSON.stringify(
                        signedData,
                    )}`,
                )
            }
            const contribution =
                chunk.contributions[chunk.contributions.length - 1]
            const contributorSignedData = contribution.contributedData
            if (!isContributorData(contributorSignedData)) {
                throw new Error(
                    `Data during verification is not valid contributor data: ${JSON.stringify(
                        contributorSignedData,
                    )}`,
                )
            }
            if (
                contributorSignedData.data.challengeHash !==
                signedData.data.challengeHash
            ) {
                throw new Error(
                    `During verification, contribution and verification challenge hashes were different: ${contributorSignedData.data.challengeHash} != ${signedData.data.challengeHash}`,
                )
            }
            if (
                contributorSignedData.data.responseHash !==
                signedData.data.responseHash
            ) {
                throw new Error(
                    `During verification, contribution and verification response hashes were different: ${contributorSignedData.data.responseHash} != ${signedData.data.responseHash}`,
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
                    `Data is not valid contributor data: ${JSON.stringify(
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
                    `During contribution, data is not valid verification data: ${JSON.stringify(
                        signedData,
                    )}`,
                )
            }
            if (
                signedData.data.challengeHash !==
                previousVerificationSignedData.data.newChallengeHash
            ) {
                throw new Error(
                    `During contribution, contribution and verification challenge hashes were different: ${signedData.data.challengeHash} != ${previousVerificationSignedData.data.newChallengeHash}`,
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
}
