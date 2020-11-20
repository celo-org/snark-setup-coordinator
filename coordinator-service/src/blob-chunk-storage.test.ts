import { expect } from 'chai'
import {
    ContainerClient,
    StorageSharedKeyCredential,
} from '@azure/storage-blob'

import { BlobChunkStorage } from './blob-chunk-storage'
import { ChunkData } from './ceremony'

describe('BlobChunkStorage', () => {
    describe('.getChunkWriteLocation', () => {
        it('returns an azure blob URL', () => {
            const account = 'accountfoo'
            const accountKey = 'doesnt matter'
            const sharedKeyCredential = new StorageSharedKeyCredential(
                account,
                accountKey,
            )
            const mockUrl = `https://${account}.blob.core.windows.net/foo`
            const containerClient = new ContainerClient(
                mockUrl,
                sharedKeyCredential,
            )
            const blobChunkStorage = new BlobChunkStorage({
                containerClient,
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
            const round = 0
            const expectedUrl = blobChunkStorage.getChunkWriteLocation({
                round,
                chunk,
                participantId,
            })

            expect(expectedUrl).to.include(
                `https://${account}.blob.core.windows.net`,
            )
        })
    })
})
