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
            participantIds: ['frank', 'becky'],
            chunks: [
                {
                    chunkId: '1',
                    location: '/some/location/1',
                },
                {
                    chunkId: '2',
                    location: '/some/location/2',
                },
            ],
        }

        DiskCoordinator.init({ config, dbPath })
        chunkStorage = new DiskChunkStorage(storagePath)
        coordinator = new DiskCoordinator({ chunkStorage, dbPath })
        app = initExpress(coordinator)
    })

    after(() => {
        storageDir.removeCallback()
    })

    describe('/ceremony', () => {
        it('returns ceremony', async () => {
            const res = await chai.request(app).get('/ceremony')
            expect(res).to.have.status(200)
        })
    })

    describe('/chunks/:id/lock', () => {
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
    })
})
