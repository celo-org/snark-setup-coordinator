import chai from 'chai'
import chaiHttp from 'chai-http'
import path from 'path'
import tmp from 'tmp'

import { AuthenticateDummy } from './authenticate-dummy'
import { initExpress } from './app'
import { Ceremony } from './ceremony'
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
            maxLocks: 1,
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
                            verifiedData: {
                                data: {
                                    challengeHash:
                                        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                                    responseHash:
                                        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                                    newChallengeHash:
                                        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                                },
                                signature:
                                    '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            },
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
                            contributedData: {
                                data: {
                                    challengeHash:
                                        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                                    responseHash:
                                        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                                    newChallengeHash:
                                        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                                },
                                signature:
                                    '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            },
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
        coordinator = new DiskCoordinator({ dbPath, maxLocks: 1 })
        app = initExpress({
            authenticateStrategy: new AuthenticateDummy(),
            coordinator,
            chunkStorage,
        })
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

    describe('PUT /ceremony', () => {
        it('updates ceremony', async () => {
            let res

            res = await chai.request(app).get('/ceremony')
            expect(res).to.have.status(200)

            const newCeremony = res.body.result
            newCeremony.chunks[0].lockHolder = 'pat'

            res = await chai
                .request(app)
                .put('/ceremony')
                .set('authorization', 'dummy verifier0')
                .send(newCeremony)
            expect(res).to.have.status(200)

            res = await chai.request(app).get('/ceremony')
            expect(res).to.have.status(200)

            newCeremony.version = 1
            expect(res.body.result).to.deep.equal(newCeremony)
        })

        it('rejects invalid versions', async () => {
            let res

            res = await chai.request(app).get('/ceremony')
            expect(res).to.have.status(200)

            const originalCeremony = res.body.result
            const newCeremony = JSON.parse(JSON.stringify(res.body.result))
            newCeremony.version = 9999
            newCeremony.chunks[0].lockHolder = 'pat'

            res = await chai
                .request(app)
                .put('/ceremony')
                .set('authorization', 'dummy verifier0')
                .send(newCeremony)
            expect(res).to.have.status(409)

            res = await chai.request(app).get('/ceremony')
            expect(res).to.have.status(200)
            expect(res.body.result).to.deep.equal(originalCeremony)
        })
    })

    describe('GET /chunks/:id/lock', () => {
        it('locks unlocked chunk', async () => {
            const res = await chai
                .request(app)
                .post('/chunks/1/lock')
                .set('authorization', 'dummy frank')
            expect(res).to.have.status(200)
            expect(res.body.result.chunkId).to.equal('1')
            expect(res.body.result.locked).to.equal(true)
        })

        it('returns 400 if lock holder tries another lock', async () => {
            await chai
                .request(app)
                .post('/chunks/1/lock')
                .set('authorization', 'dummy frank')
            const res = await chai
                .request(app)
                .post('/chunks/1/lock')
                .set('authorization', 'dummy frank')
            expect(res).to.have.status(400)
        })

        it('returns false if contributor attempts to lock unverified', async () => {
            const res = await chai
                .request(app)
                .post('/chunks/2/lock')
                .set('authorization', 'dummy frank')
            expect(res).to.have.status(200)
            expect(res.body.result.locked).to.equal(false)
        })

        it('returns false if verifier attempts to lock verified', async () => {
            const res = await chai
                .request(app)
                .post('/chunks/1/lock')
                .set('authorization', 'dummy verifier0')
            expect(res).to.have.status(200)
            expect(res.body.result.locked).to.equal(false)
        })
    })

    describe('GET /chunks/:id/contribute', () => {
        it('returns a write URL', async () => {
            const res = await chai
                .request(app)
                .get('/chunks/1/contribution')
                .set('authorization', 'dummy frank')
            expect(res).to.have.status(200)
            expect(res.body.result.writeUrl).to.be.a('string')
        })
    })

    describe('POST /chunks/:id/contribute', () => {
        it('handles contribution copy failures', async () => {
            chunkStorage.copyChunk = (): string => {
                throw new Error('fail')
            }
            const lockRes = await chai
                .request(app)
                .post('/chunks/1/lock')
                .set('authorization', 'dummy frank')
                .send({ signature: 'dummy-signature' })
            expect(lockRes).to.have.status(200)
            const contributionRes = await chai
                .request(app)
                .post('/chunks/1/contribution')
                .set('authorization', 'dummy frank')
            expect(contributionRes).to.have.status(400)
        })

        it('rejects unlocked chunk contributions', async () => {
            const res = await chai
                .request(app)
                .post('/chunks/1/contribution')
                .set('authorization', 'dummy frank')
                .send({
                    data: {
                        challengeHash:
                            '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                        responseHash:
                            '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                    },
                    signature:
                        '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                })
            expect(res).to.have.status(400)
        })

        it('accepts contributions to locked chunk', async () => {
            const lockRes = await chai
                .request(app)
                .post('/chunks/1/lock')
                .set('authorization', 'dummy frank')
                .send({ signature: 'dummy-signature' })
            expect(lockRes).to.have.status(200)
            const contributionRes = await chai
                .request(app)
                .post('/chunks/1/contribution')
                .set('authorization', 'dummy frank')
                .send({
                    data: {
                        challengeHash:
                            '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                        responseHash:
                            '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                    },
                    signature:
                        '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                })
            expect(contributionRes).to.have.status(200)
            const ceremony: Ceremony = (
                await chai.request(app).get('/ceremony')
            ).body.result
            const chunk = ceremony.chunks.find((chunk) => chunk.chunkId === '1')
            expect(chunk.lockHolder).to.equal(null)
            const lockHolderTime = new Date(chunk.metadata.lockHolderTime)
            expect(lockHolderTime).to.be.greaterThan(new Date(null))
            const contribution =
                chunk.contributions[chunk.contributions.length - 1]
            const contributedTime = new Date(
                contribution.metadata.contributedTime,
            )
            expect(contributedTime).to.be.greaterThan(new Date(null))
        })

        it('rejects contributions with wrong contribution hash', async () => {
            const lockRes = await chai
                .request(app)
                .post('/chunks/1/lock')
                .set('authorization', 'dummy frank')
                .send({ signature: 'dummy-signature' })
            expect(lockRes).to.have.status(200)
            const contributionRes = await chai
                .request(app)
                .post('/chunks/1/contribution')
                .set('authorization', 'dummy frank')
                .send({
                    data: {
                        challengeHash:
                            '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001',
                        responseHash:
                            '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                    },
                    signature:
                        '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                })
            expect(contributionRes).to.have.status(400)
        })

        it('sets verified flag for verified contributions', async () => {
            const lockRes = await chai
                .request(app)
                .post('/chunks/2/lock')
                .set('authorization', 'dummy verifier0')
                .send({ signature: 'dummy-signature' })
            expect(lockRes).to.have.status(200)
            const contributionRes = await chai
                .request(app)
                .post('/chunks/2/contribution')
                .set('authorization', 'dummy verifier0')
                .send({
                    data: {
                        challengeHash:
                            '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                        responseHash:
                            '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                        newChallengeHash:
                            '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                    },
                    signature:
                        '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                })
            expect(contributionRes).to.have.status(200)
            const ceremony: Ceremony = (
                await chai.request(app).get('/ceremony')
            ).body.result
            const chunk = ceremony.chunks.find((chunk) => chunk.chunkId === '2')
            const contribution =
                chunk.contributions[chunk.contributions.length - 1]
            expect(contribution.verified).to.equal(true)
            const verifiedTime = new Date(contribution.metadata.verifiedTime)
            expect(verifiedTime).to.be.greaterThan(new Date(null))
        })

        it('rejects verified flag with wrong contribution hash', async () => {
            const lockRes = await chai
                .request(app)
                .post('/chunks/2/lock')
                .set('authorization', 'dummy verifier0')
                .send({ signature: 'dummy-signature' })
            expect(lockRes).to.have.status(200)
            const contributionRes = await chai
                .request(app)
                .post('/chunks/2/contribution')
                .set('authorization', 'dummy verifier0')
                .send({
                    data: {
                        challengeHash:
                            '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001',
                        responseHash:
                            '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                        newChallengeHash:
                            '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                    },
                    signature:
                        '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                })
            expect(contributionRes).to.have.status(400)
        })
        it('rejects verified flag with wrong response hash', async () => {
            const lockRes = await chai
                .request(app)
                .post('/chunks/2/lock')
                .set('authorization', 'dummy verifier0')
                .send({ signature: 'dummy-signature' })
            expect(lockRes).to.have.status(200)
            const contributionRes = await chai
                .request(app)
                .post('/chunks/2/contribution')
                .set('authorization', 'dummy verifier0')
                .send({
                    data: {
                        challengeHash:
                            '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                        responseHash:
                            '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001',
                        newChallengeHash:
                            '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                    },
                    signature:
                        '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                })
            expect(contributionRes).to.have.status(400)
        })
    })
})
