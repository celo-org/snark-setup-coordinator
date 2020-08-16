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
        const storagePath = storageDir.name
        const dbPath = path.join(storagePath, 'db.json')
        const config = {
            participantIds: ['frank', 'becky'],
            chunks: [
                {
                    chunkId: 'chunk-1',
                    location: '/some/location/chunk-1',
                },
                {
                    chunkId: 'chunk-2',
                    location: '/some/location/chunk-2',
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
        it('GET', async () => {
            const res = await chai.request(app).get('/ceremony')
            expect(res).to.have.status(200)
        })
    })
})
