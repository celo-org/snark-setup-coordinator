import axios, { AxiosInstance } from 'axios'
import { BlockBlobClient } from '@azure/storage-blob'

export interface ChunkUploader {
    upload({ url, content }: { url: string; content: Buffer }): Promise<void>
}

export class DefaultChunkUploader implements ChunkUploader {
    participantId: string
    axios: AxiosInstance

    constructor({ participantId }: { participantId: string }) {
        this.participantId = participantId
        this.axios = axios.create()
    }

    async upload({
        url,
        content,
    }: {
        url: string
        content: Buffer
    }): Promise<void> {
        if (url.includes('.blob.core.windows.net')) {
            const client = new BlockBlobClient(url)
            await client.upload(content, content.length)
        } else {
            await this.axios({
                method: 'POST',
                url: url,
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'X-Participant-Id': this.participantId,
                },
                data: content,
            })
        }
    }
}
