import { expect } from 'chai'
import path from 'path'
import tmp from 'tmp'

import { authorize } from './authorize'
import { DiskCoordinator } from './disk-coordinator'

describe('authorizer', () => {
    let coordinator
    let storageDir

    before(() => {
        storageDir = tmp.dirSync({ unsafeCleanup: true })
    })

    beforeEach(() => {
        const storagePath = storageDir.name
        const dbPath = path.join(storagePath, 'db.json')
        const config = {
            round: 0,
            version: 0,
            parameters: {},
            contributorIds: ['frank', 'becky'],
            verifierIds: ['verifier0'],
            chunks: [],
        }

        DiskCoordinator.init({ config, dbPath, phase: 'phase1', force: true })
        coordinator = new DiskCoordinator({ dbPath })
    })

    after(() => {
        storageDir.removeCallback()
    })

    it('authorizes participants', (done) => {
        const allowContributors = authorize({
            coordinator,
            groups: ['verifierIds', 'contributorIds'],
        })
        const mockReq = {
            participantId: 'frank',
        }
        const mockRes = {}
        allowContributors(mockReq, mockRes, (err) => {
            expect(err).to.be.an('undefined')
            done()
        })
    })

    it('rejects participants', (done) => {
        const allowVerifiers = authorize({
            coordinator,
            groups: ['verifierIds'],
        })
        const mockReq = {
            participantId: 'frank',
        }
        let statusCode
        const mockRes = {
            status: (code): object => {
                statusCode = code
                return mockRes
            },
            json: (): object => mockRes,
        }
        allowVerifiers(mockReq, mockRes, (err) => {
            expect(err).to.be.an('error')
            expect(statusCode).to.equal(403)
            done()
        })
    })
})
