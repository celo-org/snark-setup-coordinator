import { AbortController } from '@azure/abort-controller'
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
const timeoutMilliseconds = 10 * 1000

export class BlobChunkStorage implements ChunkStorage {
    sharedKeyCredential: StorageSharedKeyCredential
    containerClient: ContainerClient
    cdn?: string

    constructor({
        containerClient,
        sharedKeyCredential,
        cdn,
    }: {
        containerClient: ContainerClient
        sharedKeyCredential: StorageSharedKeyCredential
        cdn?: string
    }) {
        this.containerClient = containerClient
        this.sharedKeyCredential = sharedKeyCredential
        this.cdn = cdn
    }

    _baseUrl(): string {
        if (this.cdn == null || !this.cdn.length) {
            return this.containerClient.url
        } else {
            return `${this.cdn}/${this.containerClient.containerName}`
        }
    }

    static _blobName(round, chunkId, version, participantId, suffix): string {
        return `${round}.${chunkId}.${version}.${participantId}${suffix}`
    }

    getChunkWriteLocation({
        round,
        chunk,
        participantId,
    }: {
        round: number
        chunk: ChunkData
        participantId: string
    }): string {
        const chunkId = chunk.chunkId
        const version = chunkVersion(chunk)

        const blobName = BlobChunkStorage._blobName(
            round,
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
        round,
        chunk,
        participantId,
    }: {
        round: number
        chunk: ChunkData
        participantId: string
    }): Promise<string> {
        const chunkId = chunk.chunkId
        const version = chunkVersion(chunk)
        const sourceBlobName = BlobChunkStorage._blobName(
            round,
            chunkId,
            version,
            participantId,
            '-unsafe',
        )
        const sourceUrl = `${this._baseUrl()}/${sourceBlobName}`
        const destinationBlobName = BlobChunkStorage._blobName(
            round,
            chunkId,
            version,
            participantId,
            '',
        )
        const destinationClient = this.containerClient.getBlobClient(
            destinationBlobName,
        )
        const abortSignal = AbortController.timeout(timeoutMilliseconds)
        const poller = await destinationClient.beginCopyFromURL(sourceUrl, {
            abortSignal,
        })
        const result = await poller.pollUntilDone()
        if (result.copyStatus !== 'success') {
            throw new Error(`Copy '${sourceUrl}' failed '${result.copyStatus}'`)
        }

        const destinationUrl = `${this._baseUrl()}/${destinationBlobName}`
        return destinationUrl
    }
}
