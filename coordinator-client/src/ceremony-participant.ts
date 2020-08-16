import axios, { AxiosInstance } from 'axios'
import shuffle = require('shuffle-array')

import { ChunkData, LockedChunkData, Ceremony } from './coordinator'

export class CeremonyParticipant {
    participantId: string
    axios: AxiosInstance

    constructor(participantId: string, baseUrl: string) {
        this.participantId = participantId
        this.axios = axios.create({
            baseURL: baseUrl,
        })
    }

    async getCeremony(): Promise<Ceremony> {
        return (
            await this.axios({
                method: 'GET',
                url: '/ceremony',
                headers: {
                    'X-Participant-Id': this.participantId,
                },
            })
        ).data.result as Ceremony
    }

    async getIncompleteChunks(): Promise<LockedChunkData[]> {
        const ceremony = await this.getCeremony()
        return ceremony.chunks.filter((chunk) => {
            return !chunk.contributions.find((contribution) => {
                return contribution.participantId == this.participantId
            })
        })
    }

    async tryLock(chunkId: string): Promise<boolean> {
        return (
            await this.axios({
                method: 'POST',
                url: `/chunks/${chunkId}/lock`,
                headers: {
                    'X-Participant-Id': this.participantId,
                },
            })
        ).data.result.locked
    }

    async getLockedChunk(): Promise<ChunkData> {
        const incompleteChunks = await this.getIncompleteChunks()
        const existingChunk = incompleteChunks.find(
            (chunk) => chunk.holder === this.participantId,
        )
        if (existingChunk) {
            return existingChunk
        }

        const unlockedChunks = incompleteChunks.filter((chunk) => !chunk.holder)
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

    async contributeChunk(chunkId: string, content: string): Promise<void> {
        await this.axios({
            method: 'POST',
            url: `/chunks/${chunkId}/contribution`,
            headers: {
                'Content-Type': 'application/octet-stream',
                'X-Participant-Id': this.participantId,
            },
            data: content,
        })
    }
}
