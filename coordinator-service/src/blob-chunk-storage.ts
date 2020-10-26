import {
    BlobSASPermissions,
    ContainerClient,
    generateBlobSASQueryParameters,
    StorageSharedKeyCredential,
} from '@azure/storage-blob'

import { ChunkData } from './ceremony'
import { ChunkStorage, chunkVersion } from './coordinator'

const expireMinutes = 60 * 2
const expireMilliseconds = 1000 * 60 * expireMinutes

export class BlobChunkStorage implements ChunkStorage {
    sharedKeyCredential: StorageSharedKeyCredential
    containerClient: ContainerClient

    constructor({
        containerClient,
        sharedKeyCredential,
    }: {
        containerClient: ContainerClient
        sharedKeyCredential: StorageSharedKeyCredential
    }) {
        this.containerClient = containerClient
        this.sharedKeyCredential = sharedKeyCredential
    }

    _baseUrl(): string {
        return this.containerClient.url
    }

    static _blobName(chunkId, version, participantId, suffix): string {
        return `${chunkId}.${version}.${participantId}${suffix}`
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

        const blobName = BlobChunkStorage._blobName(
            chunkId,
            version,
            participantId,
            '-unsafe',
        )
        const permissions = BlobSASPermissions.parse('racwd')
        const startsOn = new Date()
        const expiresOn = new Date(new Date().valueOf() + expireMilliseconds)
        const blobSAS = generateBlobSASQueryParameters(
            {
                containerName: this.containerClient.containerName,
                blobName,
                permissions,
                startsOn,
                expiresOn,
            },
            this.sharedKeyCredential,
        ).toString()
        return `${this._baseUrl()}/${blobName}?${blobSAS}`
    }

    async copyChunk({
        chunk,
        participantId,
    }: {
        chunk: ChunkData
        participantId: string
    }): Promise<string> {
        const chunkId = chunk.chunkId
        const version = chunkVersion(chunk)
        const sourceBlobName = BlobChunkStorage._blobName(
            chunkId,
            version,
            participantId,
            '-unsafe',
        )
        const sourceUrl = `${this._baseUrl()}/${sourceBlobName}`
        const destinationBlobName = BlobChunkStorage._blobName(
            chunkId,
            version,
            participantId,
            '',
        )
        const destinationClient = this.containerClient.getBlobClient(
            destinationBlobName,
        )
        const poller = await destinationClient.beginCopyFromURL(sourceUrl)
        const result = await poller.pollUntilDone()
        if (result.copyStatus !== 'success') {
            throw new Error(`Copy '${sourceUrl}' failed '${result.copyStatus}'`)
        }

        const destinationUrl = `${this._baseUrl()}/${destinationBlobName}`
        return destinationUrl
    }
}
