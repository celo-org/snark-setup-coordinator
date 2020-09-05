import {
    BlobSASPermissions,
    generateBlobSASQueryParameters,
    StorageSharedKeyCredential,
} from '@azure/storage-blob'

import { ChunkData } from './ceremony'
import { ChunkStorage, chunkVersion } from './coordinator'

const expireMinutes = 60 * 2
const expireMilliseconds = 1000 * 60 * expireMinutes

export class BlobChunkStorage implements ChunkStorage {
    containerName: string
    sharedKeyCredential: StorageSharedKeyCredential

    constructor({
        containerName,
        sharedKeyCredential,
    }: {
        containerName: string
        sharedKeyCredential: StorageSharedKeyCredential
    }) {
        this.containerName = containerName
        this.sharedKeyCredential = sharedKeyCredential
    }

    _baseUrl(): string {
        return `https://${this.sharedKeyCredential.accountName}.blob.core.windows.net`
    }

    getChunkWriteLocation({
        chunk,
        participantId,
    }: {
        chunk: ChunkData
        participantId: string
    }): string {
        const chunkId = chunk.chunkId
        const version = chunkVersion(chunk)

        const blobName = `${chunkId}.${version}.${participantId}`
        const permissions = BlobSASPermissions.parse('racwd')
        const startsOn = new Date()
        const expiresOn = new Date(new Date().valueOf() + expireMilliseconds)
        const blobSAS = generateBlobSASQueryParameters(
            {
                containerName: this.containerName,
                blobName,
                permissions,
                startsOn,
                expiresOn,
            },
            this.sharedKeyCredential,
        ).toString()
        return `${this._baseUrl()}/${this.containerName}/${blobName}?${blobSAS}`
    }

    copyChunk({
        chunk,
        participantId,
    }: {
        chunk: ChunkData
        participantId: string
    }): string {
        const chunkId = chunk.chunkId
        const version = chunkVersion(chunk)
        const blobName = `${chunkId}.${version}.${participantId}`
        return `${this._baseUrl()}/${this.containerName}/${blobName}`
    }
}
