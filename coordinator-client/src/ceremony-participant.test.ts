import { expect } from 'chai'
import nock from 'nock'

import { AuthDummy } from './auth-dummy'
import { DefaultChunkUploader } from './chunk-uploader'
import { CeremonyContributor, CeremonyVerifier } from './ceremony-participant'

const auth = new AuthDummy('bitdiddle')
const chunkUploader = new DefaultChunkUploader({ auth })

describe('CeremonyVerifier', () => {
    describe('.getChunksRemaining', () => {
        it('returns all chunks that have not been verified completely', async () => {
            nock('http://mock')
                .get('/ceremony')
                .reply(200, {
                    result: {
                        contributorIds: ['bitdiddle'],
                        verifierIds: ['verifier0'],
                        chunks: [
                            {
                                chunkId: 'verifiedChunkId',
                                contributions: [
                                    {
                                        verifierId: 'verifier0',
                                        verified: true,
                                    },
                                ],
                            },
                            {
                                chunkId: 'unverifiedChunkId',
                                contributions: [
                                    {
                                        verifierId: 'verifier0',
                                        verified: true,
                                    },
                                    {
                                        contributorId: 'bitdiddle',
                                        verified: false,
                                    },
                                ],
                            },
                        ],
                    },
                })
            const client = new CeremonyVerifier({
                auth,
                participantId: 'bitdiddle',
                baseUrl: 'http://mock',
                chunkUploader,
            })
            const chunks = await client.getChunksRemaining()
            expect(chunks.length).to.equal(2)
        })
    })
})

describe('CeremonyContributor', () => {
    describe('.getCeremony', () => {
        it('returns Ceremony', async () => {
            nock('http://mock')
                .get('/ceremony')
                .reply(200, {
                    result: {
                        contributorIds: ['bitdiddle'],
                    },
                })
            const client = new CeremonyContributor({
                auth,
                participantId: 'bitdiddle',
                baseUrl: 'http://mock',
                chunkUploader,
            })
            const ceremony = await client.getCeremony()
            expect(ceremony.contributorIds.length).to.equal(1)
        })
    })

    describe('.getChunksAcceptingContributions', () => {
        it('returns only chunks with verified contributions', async () => {
            nock('http://mock')
                .get('/ceremony')
                .reply(200, {
                    result: {
                        chunks: [
                            {
                                chunkId: 'verifiedChunkId',
                                contributions: [
                                    {
                                        verifierId: 'verifier0',
                                        verified: true,
                                    },
                                ],
                            },
                            {
                                chunkId: 'unverifiedChunkId',
                                contributions: [
                                    {
                                        contributorId: 'bitdiddle',
                                        verified: false,
                                    },
                                ],
                            },
                        ],
                    },
                })
            const client = new CeremonyContributor({
                auth,
                participantId: 'bitdiddle',
                baseUrl: 'http://mock',
                chunkUploader,
            })
            const chunks = await client.getChunksAcceptingContributions()
            expect(chunks.length).to.equal(1)
            expect(chunks[0].chunkId).to.equal('verifiedChunkId')
        })
    })

    describe('.getLockedChunk', () => {
        it('returns chunk with existing lock', async () => {
            nock('http://mock')
                .get('/ceremony')
                .reply(200, {
                    result: {
                        chunks: [
                            {
                                chunkId: 'foo-chunk-id',
                                contributions: [
                                    {
                                        verifiedId: 'verifier0',
                                        verified: true,
                                    },
                                ],
                                lockHolder: 'bitdiddle',
                            },
                        ],
                        contributorIds: ['bitdiddle'],
                    },
                })
            const client = new CeremonyContributor({
                auth,
                participantId: 'bitdiddle',
                baseUrl: 'http://mock',
                chunkUploader,
            })
            const chunk = await client.getLockedChunk()
            expect(chunk.chunkId).to.equal('foo-chunk-id')
        })
    })
})
