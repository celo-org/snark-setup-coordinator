import axios, { AxiosInstance } from 'axios'
import { BlockBlobClient } from '@azure/storage-blob'

import { Auth } from './auth'

export interface ChunkUploader {
    upload({ url, content }: { url: string; content: Buffer }): Promise<void>
}

export class DefaultChunkUploader implements ChunkUploader {
    auth: Auth
    axios: AxiosInstance

    constructor({ auth }: { auth: Auth }) {
        this.auth = auth
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
            const parsedUrl = new URL(url)
            await this.axios({
                method: 'POST',
                url,
                headers: {
                    'Content-Type': 'application/octet-stream',
                    Authorization: this.auth.getAuthorizationValue({
                        method: 'POST',
                        path: parsedUrl.pathname,
                    }),
                },
                data: content,
            })
        }
    }
}
