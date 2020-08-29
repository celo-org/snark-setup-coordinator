import { expect } from 'chai'
import { StorageSharedKeyCredential } from '@azure/storage-blob'

import { BlobChunkStorage } from './blob-chunk-storage'
import { ChunkData } from './ceremony'

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
            const chunk = {
                chunkId: 'chunkfoo',
                contributions: [
                    {
                        contributorId: null,
                        contributedLocation: null,
                        verifierId: 'verifier0',
                        verifiedLocation:
                            'http://testing:8080/chunks/chunk-1/contribution/0',
                        verified: true,
                    },
                ],
            } as ChunkData
            const participantId = 'ben'
            const expectedUrl = blobChunkStorage.getChunkWriteLocation({
                chunk,
                participantId,
            })

            expect(expectedUrl).to.include(
                `https://${account}.blob.core.windows.net`,
            )
        })
    })
})
