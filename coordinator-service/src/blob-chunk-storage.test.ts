import { expect } from 'chai'

import { BlobChunkStorage } from './blob-chunk-storage'

import { StorageSharedKeyCredential } from '@azure/storage-blob'

describe('BlobChunkStorage', () => {
    describe('.getChunkWriteLocation', () => {
        it('returns an azure blob URL', () => {
            const containerName = 'foo'
            const account = 'accountfoo'
            const accountKey = 'doesnt matter'
            const sharedKeyCredential = new StorageSharedKeyCredential(
                account,
                accountKey,
            )
            const blobChunkStorage = new BlobChunkStorage({
                containerName,
                sharedKeyCredential,
            })
            const chunkId = 'chunkfoo'
            const participantId = 'ben'
            const version = '1'
            const expectedUrl = blobChunkStorage.getChunkWriteLocation({
                chunkId,
                participantId,
                version,
            })

            expect(expectedUrl).to.include(
                `https://${account}.blob.core.windows.net`,
            )
        })
    })
})
