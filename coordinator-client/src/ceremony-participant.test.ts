import { expect } from 'chai'
import nock from 'nock'

import { CeremonyParticipant } from './ceremony-participant'

describe('CeremonyParticipant', () => {
    describe('.getCeremony', () => {
        it('returns Ceremony', async () => {
            nock('http://mock')
                .get('/ceremony')
                .reply(200, {
                    result: {
                        participantIds: ['bitdiddle'],
                    },
                })
            const client = new CeremonyParticipant('bitdiddle', 'http://mock')
            const ceremony = await client.getCeremony()
            expect(ceremony.participantIds.length).to.equal(1)
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
                                contributions: [],
                                holder: 'bitdiddle',
                            },
                        ],
                        participantIds: ['bitdiddle'],
                    },
                })
            const client = new CeremonyParticipant('bitdiddle', 'http://mock')
            const chunk = await client.getLockedChunk()
            expect(chunk.chunkId).to.equal('foo-chunk-id')
        })
    })
})
