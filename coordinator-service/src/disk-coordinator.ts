import fs from 'fs'
import { Ceremony, Coordinator, LockedChunkData } from './coordinator'

interface DiskCoordinatorConfig {
    chunks: { chunkId: string; location: string; verified: boolean }[]
    participantIds: string[]
    verifierIds: string[]
}

export class DiskCoordinator implements Coordinator {
    dbPath: string

    static init({
        config,
        dbPath,
    }: {
        config: DiskCoordinatorConfig
        dbPath: string
    }): void {
        const ceremony = {
            chunks: config.chunks.map((configChunk) => ({
                chunkId: configChunk.chunkId,
                contributions: [
                    {
                        location: configChunk.location,
                        participantId: '0',
                        verified: configChunk.verified,
                    },
                ],
                holder: null,
            })),
            participantIds: config.participantIds,
            verifierIds: config.verifierIds,
        }
        fs.writeFileSync(dbPath, JSON.stringify(ceremony, null, 2))
    }

    constructor({ dbPath }: { dbPath: string }) {
        this.dbPath = dbPath
    }

    _readDb(): Ceremony {
        return JSON.parse(fs.readFileSync(this.dbPath).toString())
    }

    _writeDb(ceremony: Ceremony): void {
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

    getChunk(chunkId: string): LockedChunkData {
        const ceremony = this._readDb()
        return DiskCoordinator._getChunk(ceremony, chunkId)
    }

    tryLockChunk(chunkId: string, participantId: string): boolean {
        const ceremony = this._readDb()

        const holding = ceremony.chunks.find(
            (chunk) => chunk.holder === participantId,
        )
        if (holding) {
            throw new Error(
                `${participantId} already holds lock on chunk ${holding.chunkId}`,
            )
        }

        const chunk = DiskCoordinator._getChunk(ceremony, chunkId)
        if (chunk.holder) {
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

        chunk.holder = participantId
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
        if (chunk.holder !== participantId) {
            throw new Error(
                `Participant ${participantId} does not hold lock ` +
                    `on chunk ${chunkId}`,
            )
        }
        const verified = ceremony.verifierIds.includes(participantId)
        chunk.contributions.push({
            location,
            participantId,
            verified,
        })
        chunk.holder = null
        this._writeDb(ceremony)
    }
}
