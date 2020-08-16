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
})
