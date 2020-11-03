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
        const testData = {
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
        }
        const config = {
            round: 0,
            version: 0,
            maxLocks: 1,
            shutdownSignal: false,
            parameters: {},
            contributorIds: ['frank', 'becky', 'pat'],
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
                            verifiedData: testData,
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
                            contributedData: testData,
                            verifierId: null,
                            verifiedLocation: null,
                            verified: false,
                        },
                    ],
                },
                {
                    chunkId: '3',
                    lockHolder: null,
                    contributions: [
                        {
                            contributorId: 'pat',
                            contributedLocation: '/some/location/2',
                            contributedData: testData,
                            verifierId: null,
                            verifiedLocation: null,
                            verified: true,
                        },
                    ],
                },
                {
                    chunkId: '4',
                    lockHolder: null,
                    contributions: [
                        {
                            contributorId: 'pat',
                            contributedLocation: '/some/location/2',
                            contributedData: testData,
                            verifierId: null,
                            verifiedLocation: '/some/location/123',
                            verified: true,
                        },
                        {
                            contributorId: 'bill',
                            contributedLocation: '/some/location/234',
                            contributedData: testData,
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

    describe('GET /contributor/:id/chunks', () => {
        it('matches ceremony', async () => {
            const res = await chai.request(app).get('/contributor/pat/chunks')
            expect(res).to.have.status(200)
            const expected = {
                chunks: [{ lockHolder: null, chunkId: '1' }],
                numNonContributed: 1,
                parameters: {},
                numChunks: 4,
                maxLocks: 1,
                shutdownSignal: false,
            }
            expect(res.body.result).to.deep.equal(expected)
        })

        it('a new contributor', async () => {
            const res = await chai.request(app).get('/contributor/bill/chunks')
            expect(res).to.have.status(200)
            expect(
                res.body.result.chunks.every((a) => !a.contributed),
            ).to.equal(true)
        })
    })

    describe('GET /verifier/chunks', () => {
        it('matches ceremony', async () => {
            const res = await chai.request(app).get('/verifier/chunks')
            expect(res).to.have.status(200)

            const expected = {
                chunks: [
                    { lockHolder: null, chunkId: '2' },
                    { lockHolder: null, chunkId: '4' },
                ],
                numNonContributed: 2,
                parameters: {},
                numChunks: 4,
                maxLocks: 1,
                shutdownSignal: false,
            }
            expect(res.body.result).to.deep.equal(expected)
        })
    })

    describe('GET /chunks/:id/info', () => {
        it('info for chunk 1', async () => {
            const res = await chai.request(app).get('/chunks/1/info')
            expect(res).to.have.status(200)
            const expected = {
                chunkId: '1',
                lockHolder: null,
                lastResponseUrl: null,
                lastChallengeUrl: '/some/location/1',
                previousChallengeUrl: null,
            }
            expect(res.body.result).to.deep.equal(expected)
        })
        it('info for chunk 2', async () => {
            const res = await chai.request(app).get('/chunks/2/info')
            expect(res).to.have.status(200)
            const expected = {
                chunkId: '2',
                lockHolder: null,
                lastResponseUrl: '/some/location/2',
                lastChallengeUrl: null,
                previousChallengeUrl: null,
            }
            expect(res.body.result).to.deep.equal(expected)
        })
        it('info for chunk 4', async () => {
            const res = await chai.request(app).get('/chunks/4/info')
            expect(res).to.have.status(200)
            const expected = {
                chunkId: '4',
                lockHolder: null,
                lastResponseUrl: '/some/location/234',
                lastChallengeUrl: null,
                previousChallengeUrl: '/some/location/123',
            }
            expect(res.body.result).to.deep.equal(expected)
        })
        it('info for unknown chunk', async () => {
            const res = await chai.request(app).get('/chunks/2345/info')
            expect(res).to.have.status(400)
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

        it('returns false if lock holder tries another lock', async () => {
            await chai
                .request(app)
                .post('/chunks/1/lock')
                .set('authorization', 'dummy frank')
            const res = await chai
                .request(app)
                .post('/chunks/1/lock')
                .set('authorization', 'dummy frank')
            expect(res).to.have.status(200)
            expect(res.body.result.locked).to.equal(false)
        })

        it('rejects if contributor attempts to lock unverified', async () => {
            const res = await chai
                .request(app)
                .post('/chunks/2/lock')
                .set('authorization', 'dummy frank')
            expect(res).to.have.status(400)
        })

        it('rejects if contributor attempts to lock a chunk it has already contributed to', async () => {
            const res = await chai
                .request(app)
                .post('/chunks/3/lock')
                .set('authorization', 'dummy pat')
            expect(res).to.have.status(400)
        })

        it('rejects if verifier attempts to lock verified', async () => {
            const res = await chai
                .request(app)
                .post('/chunks/1/lock')
                .set('authorization', 'dummy verifier0')
            expect(res).to.have.status(400)
        })

        it('accepts locks <= max locks and rejects otherwise', async () => {
            let res

            res = await chai.request(app).get('/ceremony')
            expect(res).to.have.status(200)

            const newCeremony = res.body.result
            newCeremony.maxLocks = 2

            res = await chai
                .request(app)
                .put('/ceremony')
                .set('authorization', 'dummy verifier0')
                .send(newCeremony)
            expect(res).to.have.status(200)

            res = await chai.request(app).get('/ceremony')
            expect(res).to.have.status(200)
            expect(res.body.result.maxLocks).to.equal(2)

            res = await chai
                .request(app)
                .post('/chunks/1/lock')
                .set('authorization', 'dummy frank')
            expect(res).to.have.status(200)
            expect(res.body.result.locked).to.equal(true)

            res = await chai
                .request(app)
                .post('/chunks/3/lock')
                .set('authorization', 'dummy frank')
            expect(res).to.have.status(200)
            expect(res.body.result.locked).to.equal(true)

            res = await chai
                .request(app)
                .post('/chunks/4/lock')
                .set('authorization', 'dummy frank')
            expect(res).to.have.status(400)
        })
    })

    describe('GET /chunks/:id/unlock', () => {
        it('unlocks locked chunk', async () => {
            let res

            res = await chai
                .request(app)
                .post('/chunks/1/lock')
                .set('authorization', 'dummy frank')
            expect(res).to.have.status(200)
            expect(res.body.result.chunkId).to.equal('1')
            expect(res.body.result.locked).to.equal(true)

            res = await chai
                .request(app)
                .post('/chunks/1/unlock')
                .set('authorization', 'dummy frank')
            expect(res).to.have.status(200)
            expect(res.body.result.chunkId).to.equal('1')
            expect(res.body.result.unlocked).to.equal(true)
        })

        it('returns 400 if participant does not hold lock', async () => {
            const res = await chai
                .request(app)
                .post('/chunks/1/unlock')
                .set('authorization', 'dummy frank')
            expect(res).to.have.status(400)
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
