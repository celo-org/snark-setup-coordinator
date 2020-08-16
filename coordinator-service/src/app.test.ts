import chai from 'chai'
import chaiHttp from 'chai-http'

import { initExpress } from './app'

const expect = chai.expect

chai.use(chaiHttp)
chai.should()

describe('app', () => {
    const app = initExpress()

    describe('/ceremony', () => {
        it('GET', async () => {
            const res = await chai.request(app).get('/ceremony')
            expect(res).to.have.status(200)
        })
    })
})
