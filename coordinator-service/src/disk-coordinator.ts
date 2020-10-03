import fs from 'fs'

import { Coordinator } from './coordinator'
import { Ceremony, LockedChunkData } from './ceremony'

function timestamp(): string {
    return new Date().toISOString()
}

export class DiskCoordinator implements Coordinator {
    dbPath: string

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
        config.parameters = config.parameters || {}

        // Add metadata fields if they're missing.
        for (const lockedChunk of config.chunks) {
            lockedChunk.metadata = lockedChunk.metadata ?? {
                lockHolderTime: null,
            }
            for (const contribution of lockedChunk.contributions) {
                contribution.metadata = contribution.metadata ?? {
                    contributedTime: null,
                    verifiedTime: null,
                }
            }
        }

        fs.writeFileSync(dbPath, JSON.stringify(config, null, 2))
    }

    constructor({ dbPath }: { dbPath: string }) {
        this.dbPath = dbPath
    }

    _readDb(): Ceremony {
        return JSON.parse(fs.readFileSync(this.dbPath).toString())
    }

    _writeDb(ceremony: Ceremony): void {
        ceremony.version += 1
        fs.writeFileSync(this.dbPath, JSON.stringify(ceremony, null, 2))
    }

    getCeremony(): Ceremony {
        return this._readDb()
    }

    static _getChunk(ceremony: Ceremony, chunkId: string): LockedChunkData {
        const chunk = ceremony.chunks.find((chunk) => chunk.chunkId == chunkId)
        if (!chunk) {
            throw new Error(`Unknown chunkId ${chunkId}`)
        }
        return chunk
    }

    setCeremony(newCeremony: Ceremony): void {
        const ceremony = this._readDb()
        if (ceremony.version !== newCeremony.version) {
            throw new Error(
                `New ceremony is out of date: ${ceremony.version} vs ${newCeremony.version}`,
            )
        }
        this._writeDb(newCeremony)
    }

    getChunk(chunkId: string): LockedChunkData {
        const ceremony = this._readDb()
        return DiskCoordinator._getChunk(ceremony, chunkId)
    }

    tryLockChunk(chunkId: string, participantId: string): boolean {
        const ceremony = this._readDb()

        const holding = ceremony.chunks.find(
            (chunk) => chunk.lockHolder === participantId,
        )
        if (holding) {
            throw new Error(
                `${participantId} already holds lock on chunk ${holding.chunkId}`,
            )
        }

        const chunk = DiskCoordinator._getChunk(ceremony, chunkId)
        if (chunk.lockHolder) {
            return false
        }
        //
        // Return false if contributor trying to lock unverified chunk or
        // if verifier trying to lock verified chunk.
        //
        const verifier = ceremony.verifierIds.includes(participantId)
        const lastContribution =
            chunk.contributions[chunk.contributions.length - 1]
        if (lastContribution.verified === verifier) {
            return false
        }

        chunk.lockHolder = participantId
        chunk.metadata.lockHolderTime = timestamp()
        this._writeDb(ceremony)
        return true
    }

    async contributeChunk(
        chunkId: string,
        participantId: string,
        location: string,
    ): Promise<void> {
        const ceremony = this._readDb()
        const chunk = DiskCoordinator._getChunk(ceremony, chunkId)
        if (chunk.lockHolder !== participantId) {
            throw new Error(
                `Participant ${participantId} does not hold lock ` +
                    `on chunk ${chunkId}`,
            )
        }
        const verifier = ceremony.verifierIds.includes(participantId)
        if (verifier) {
            const contribution =
                chunk.contributions[chunk.contributions.length - 1]
            contribution.verifierId = participantId
            contribution.verifiedLocation = location
            contribution.verified = true
            contribution.metadata.verifiedTime = timestamp()
        } else {
            chunk.contributions.push({
                metadata: {
                    contributedTime: timestamp(),
                    verifiedTime: null,
                },
                contributorId: participantId,
                contributedLocation: location,
                verifierId: null,
                verifiedLocation: null,
                verified: false,
            })
        }
        chunk.lockHolder = null
        this._writeDb(ceremony)
    }
}
