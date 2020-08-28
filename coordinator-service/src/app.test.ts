import chai from 'chai'
import chaiHttp from 'chai-http'
import path from 'path'
import tmp from 'tmp'

import { initExpress } from './app'
import { DiskCoordinator } from './disk-coordinator'
import { DiskChunkStorage } from './disk-chunk-storage'

const expect = chai.expect

chai.use(chaiHttp)
chai.should()

describe('app', () => {
    const chunkStorageUrl = 'http://doesnt-matter'

    let app
    let chunkStorage
    let coordinator
    let storageDir

    before(() => {
        storageDir = tmp.dirSync({ unsafeCleanup: true })
    })

    beforeEach(() => {
        const storagePath = storageDir.name
        const dbPath = path.join(storagePath, 'db.json')
        const config = {
            version: 0,
            participantIds: ['frank', 'becky'],
            verifierIds: ['verifier0'],
            chunks: [
                {
                    chunkId: '1',
                    holder: null,
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
                    holder: null,
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

        DiskCoordinator.init({ config, dbPath, force: true })
        chunkStorage = new DiskChunkStorage({ storagePath, chunkStorageUrl })
        coordinator = new DiskCoordinator({ dbPath })
        app = initExpress({ coordinator, chunkStorage })
    })

    after(() => {
        storageDir.removeCallback()
    })

    describe('GET /ceremony', () => {
        it('returns ceremony', async () => {
            const res = await chai.request(app).get('/ceremony')
            expect(res).to.have.status(200)
        })
    })

    describe('GET /chunks/:id/lock', () => {
        it('locks unlocked chunk', async () => {
            const res = await chai
                .request(app)
                .post('/chunks/1/lock')
                .set('x-participant-id', 'frank')
            expect(res).to.have.status(200)
            expect(res.body.result.chunkId).to.equal('1')
            expect(res.body.result.locked).to.equal(true)
        })

        it('returns 400 if lock holder tries another lock', async () => {
            await chai
                .request(app)
                .post('/chunks/1/lock')
                .set('x-participant-id', 'frank')
            const res = await chai
                .request(app)
                .post('/chunks/1/lock')
                .set('x-participant-id', 'frank')
            expect(res).to.have.status(400)
        })

        it('returns false if contributor attempts to lock unverified', async () => {
            const res = await chai
                .request(app)
                .post('/chunks/2/lock')
                .set('x-participant-id', 'frank')
            expect(res).to.have.status(200)
            expect(res.body.result.locked).to.equal(false)
        })

        it('returns false if verifier attempts to lock verified', async () => {
            const res = await chai
                .request(app)
                .post('/chunks/1/lock')
                .set('x-participant-id', 'verifier0')
            expect(res).to.have.status(200)
            expect(res.body.result.locked).to.equal(false)
        })
    })

    describe('GET /chunks/:id/contribute', () => {
        it('returns a write URL', async () => {
            const res = await chai
                .request(app)
                .get('/chunks/1/contribution')
                .set('x-participant-id', 'frank')
            expect(res).to.have.status(200)
            expect(res.body.result.writeUrl).to.be.a('string')
        })
    })

    describe('POST /chunks/:id/contribute', () => {
        it('rejects unlocked chunk contributions', async () => {
            const res = await chai
                .request(app)
                .post('/chunks/1/contribution')
                .set('x-participant-id', 'frank')
            expect(res).to.have.status(400)
        })

        it('accepts contributions to locked chunk', async () => {
            const lockRes = await chai
                .request(app)
                .post('/chunks/1/lock')
                .set('x-participant-id', 'frank')
            expect(lockRes).to.have.status(200)
            const contributionRes = await chai
                .request(app)
                .post('/chunks/1/contribution')
                .set('x-participant-id', 'frank')
            expect(contributionRes).to.have.status(200)
            const ceremony = (await chai.request(app).get('/ceremony')).body
                .result
            const chunk = ceremony.chunks.find((chunk) => chunk.chunkId === '1')
            expect(chunk.holder).to.equal(null)
        })

        it('sets verified flag for verified contributions', async () => {
            const lockRes = await chai
                .request(app)
                .post('/chunks/2/lock')
                .set('x-participant-id', 'verifier0')
            expect(lockRes).to.have.status(200)
            const contributionRes = await chai
                .request(app)
                .post('/chunks/2/contribution')
                .set('x-participant-id', 'verifier0')
            expect(contributionRes).to.have.status(200)
            const ceremony = (await chai.request(app).get('/ceremony')).body
                .result
            const chunk = ceremony.chunks.find((chunk) => chunk.chunkId === '2')
            const contribution =
                chunk.contributions[chunk.contributions.length - 1]
            expect(contribution.verified).to.equal(true)
        })
    })
})
