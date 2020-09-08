import axios, { AxiosInstance } from 'axios'
import shuffle = require('shuffle-array')

import { Auth } from './auth'
import { ChunkData, LockedChunkData, Ceremony } from './ceremony'
import { ChunkUploader } from './chunk-uploader'
import { logger } from './logger'

export abstract class CeremonyParticipant {
    auth: Auth
    participantId: string
    axios: AxiosInstance
    chunkUploader: ChunkUploader

    constructor({
        auth,
        participantId,
        baseUrl,
        chunkUploader,
    }: {
        auth: Auth
        participantId: string
        baseUrl: string
        chunkUploader: ChunkUploader
    }) {
        this.auth = auth
        this.participantId = participantId
        this.axios = axios.create({
            baseURL: baseUrl,
        })
        this.chunkUploader = chunkUploader
    }

    // All the chunks this participant still might need to do work on
    abstract getChunksRemaining(): Promise<LockedChunkData[]>
    // All the chunks currently accepting contributions from this participant
    abstract getChunksAcceptingContributions(): Promise<LockedChunkData[]>

    async getCeremony(): Promise<Ceremony> {
        const method = 'GET'
        const path = '/ceremony'
        return (
            await this.axios({
                method,
                url: path,
                headers: {
                    Authorization: this.auth.getAuthorizationValue({
                        method,
                        path,
                    }),
                },
            })
        ).data.result as Ceremony
    }

    async tryLock(chunkId: string): Promise<boolean> {
        const method = 'POST'
        const path = `/chunks/${chunkId}/lock`
        return (
            await this.axios({
                method,
                url: path,
                headers: {
                    Authorization: this.auth.getAuthorizationValue({
                        method,
                        path,
                    }),
                },
            })
        ).data.result.locked
    }

    async getLockedChunk(): Promise<ChunkData> {
        const incompleteChunks = await this.getChunksAcceptingContributions()
        const existingChunk = incompleteChunks.find(
            (chunk) => chunk.lockHolder === this.participantId,
        )
        if (existingChunk) {
            return existingChunk
        }

        const unlockedChunks = incompleteChunks.filter(
            (chunk) => !chunk.lockHolder,
        )
        // Shuffle to mitigate thundering herd problems.
        shuffle(unlockedChunks)
        for (const chunk of unlockedChunks) {
            const locked = await this.tryLock(chunk.chunkId)
            if (locked) {
                return chunk
            }
        }
        return null
    }

    async contributeChunk(chunkId: string, content: Buffer): Promise<void> {
        const destinationMethod = 'GET'
        const destinationPath = `/chunks/${chunkId}/contribution`
        const writeUrl = (
            await this.axios({
                method: destinationMethod,
                url: destinationPath,
                headers: {
                    Authorization: this.auth.getAuthorizationValue({
                        method: destinationMethod,
                        path: destinationPath,
                    }),
                },
            })
        ).data.result.writeUrl

        await this.chunkUploader.upload({ url: writeUrl, content })

        const contributeMethod = 'POST'
        const contributePath = `/chunks/${chunkId}/contribution`
        await this.axios({
            method: contributeMethod,
            url: contributePath,
            headers: {
                Authorization: this.auth.getAuthorizationValue({
                    method: contributeMethod,
                    path: contributePath,
                }),
            },
        })
    }
}

export class CeremonyContributor extends CeremonyParticipant {
    async getChunksRemaining(): Promise<LockedChunkData[]> {
        const ceremony = await this.getCeremony()
        return ceremony.chunks.filter((chunk) => {
            //
            // Any chunk this.participantId hasn't contribute to.
            //
            return !chunk.contributions.find((contribution) => {
                return contribution.contributorId === this.participantId
            })
        })
    }

    async getChunksAcceptingContributions(): Promise<LockedChunkData[]> {
        const ceremony = await this.getCeremony()
        return ceremony.chunks.filter((chunk) => {
            const contributions = chunk.contributions
            if (!contributions.length) {
                logger.warn(`missing contributions for chunk ${chunk.chunkId}`)
                return false
            }
            //
            // Chunks with the last contribution verified and that this.participantId
            // hasn't contributed to.
            //
            const lastContribution = contributions[contributions.length - 1]
            if (!lastContribution.verified) {
                return false
            }
            return !chunk.contributions.find((contribution) => {
                return contribution.contributorId === this.participantId
            })
        })
    }
}

export class CeremonyVerifier extends CeremonyParticipant {
    async getChunksRemaining(): Promise<LockedChunkData[]> {
        const ceremony = await this.getCeremony()
        return ceremony.chunks.filter((chunk) => {
            const contributions = chunk.contributions
            if (!contributions.length) {
                logger.warn(`missing contributions for chunk ${chunk.chunkId}`)
                return false
            }
            //
            // Chunks with unverified contributions or missing contributions from
            // participants.
            //
            const lastContribution = contributions[contributions.length - 1]
            if (!lastContribution.verified) {
                return true
            }
            const contributorIds = contributions
                .filter((contribution) => contribution.contributorId)
                .map((contribution) => contribution.contributorId)
            return !ceremony.contributorIds.every((particpantsId) =>
                contributorIds.includes(particpantsId),
            )
        })
    }

    async getChunksAcceptingContributions(): Promise<LockedChunkData[]> {
        const ceremony = await this.getCeremony()
        return ceremony.chunks.filter((chunk) => {
            const contributions = chunk.contributions
            if (!contributions.length) {
                logger.warn(`Missing contributions for chunk ${chunk.chunkId}`)
                return false
            }
            //
            // Chunks with the last contribution unverified
            //
            const lastContribution = contributions[contributions.length - 1]
            return !lastContribution.verified
        })
    }
}
