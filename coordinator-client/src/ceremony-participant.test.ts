import { expect } from 'chai'
import nock from 'nock'

import { CeremonyContributor, CeremonyVerifier } from './ceremony-participant'

describe('CeremonyVerifier', () => {
    describe('.getChunksRemaining', () => {
        it('returns all chunks that have not been verified completely', async () => {
            nock('http://mock')
                .get('/ceremony')
                .reply(200, {
                    result: {
                        participantIds: ['bitdiddle'],
                        verifierIds: ['verifier0'],
                        chunks: [
                            {
                                chunkId: 'verifiedChunkId',
                                contributions: [
                                    {
                                        participantId: 'verifier0',
                                        verified: true,
                                    },
                                ],
                            },
                            {
                                chunkId: 'unverifiedChunkId',
                                contributions: [
                                    {
                                        participantId: 'verifier0',
                                        verified: true,
                                    },
                                    {
                                        participantId: 'bitdiddle',
                                        verified: false,
                                    },
                                ],
                            },
                        ],
                    },
                })
            const client = new CeremonyVerifier('bitdiddle', 'http://mock')
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
                        participantIds: ['bitdiddle'],
                    },
                })
            const client = new CeremonyContributor('bitdiddle', 'http://mock')
            const ceremony = await client.getCeremony()
            expect(ceremony.participantIds.length).to.equal(1)
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
                                        participantId: 'verifier0',
                                        verified: true,
                                    },
                                ],
                            },
                            {
                                chunkId: 'unverifiedChunkId',
                                contributions: [
                                    {
                                        participantId: 'bitdiddle',
                                        verified: false,
                                    },
                                ],
                            },
                        ],
                    },
                })
            const client = new CeremonyContributor('bitdiddle', 'http://mock')
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
                                        participantId: 'verifier0',
                                        verified: true,
                                    },
                                ],
                                holder: 'bitdiddle',
                            },
                        ],
                        participantIds: ['bitdiddle'],
                    },
                })
            const client = new CeremonyContributor('bitdiddle', 'http://mock')
            const chunk = await client.getLockedChunk()
            expect(chunk.chunkId).to.equal('foo-chunk-id')
        })
    })
})
