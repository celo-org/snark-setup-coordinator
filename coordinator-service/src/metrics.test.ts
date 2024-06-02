import chai from 'chai'
import chaiHttp from 'chai-http'
import path from 'path'
import tmp from 'tmp'

import { initMetrics } from './metrics'
import { DiskCoordinator } from './disk-coordinator'

const expect = chai.expect

chai.use(chaiHttp)
chai.should()

describe('metrics', () => {
    let metricsApp
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
            maxLocks: 1,
            shutdownSignal: false,
            parameters: {},
            contributorIds: ['frank', 'becky'],
            verifierIds: ['verifier0'],
            chunks: [
                {
                    chunkId: '1',
                    lockHolder: null,
                    contributions: [
                        {
                            contributorId: null,
                            contributedLocation: null,
                            verifiedLocation: '/some/location/1',
                            verifierId: 'verifier0',
                            verified: true,
                        },
                    ],
                },
                {
                    chunkId: '2',
                    lockHolder: null,
                    contributions: [
                        {
                            contributorId: 'pat',
                            contributedLocation: '/some/location/2',
                            verifierId: null,
                            verifiedLocation: null,
                            verified: false,
                        },
                    ],
                },
            ],
        }

        DiskCoordinator.init({ config, dbPath, phase: 'phase1', force: true })
        coordinator = new DiskCoordinator({ dbPath })
        metricsApp = initMetrics({
            coordinator,
        })
    })

    after(() => {
        storageDir.removeCallback()
    })

    describe('GET /metrics', () => {
        it('returns 200', async () => {
            const res = await chai.request(metricsApp).get('/metrics')
            expect(res).to.have.status(200)
        })

        it('returns some metrics', async () => {
            const res = await chai.request(metricsApp).get('/metrics')
            expect(res.text).include('coordinator_ceremony_version_info')
            expect(res.text).include('coordinator_ceremony_lock_info')
            expect(res.text).include('coordinator_ceremony_lock_timestamp')
        })
    })
})
