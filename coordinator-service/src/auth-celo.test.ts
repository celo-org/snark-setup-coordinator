import { expect } from 'chai'
import { SignatureUtils } from '@celo/utils/lib/signatureUtils'

import { authCelo } from './auth-celo'

describe('celoAuth', () => {
    it('accepts valid authorization', (done) => {
        const method = 'get'
        const path = '/flarb/snarg/bronb'
        const privateKey =
            '0xa9cf8102c152fa21ac170c6688b6f3df59ad05fb80d8035c4ed8cbc2617886e7'
        const address = '0xEC60b9a43529c12CA83Af466D8A6F8444392D47C'
        const message = `${method} ${path}`
        const signature = SignatureUtils.signMessage(
            message,
            privateKey,
            address,
        )
        const serializedSignature = SignatureUtils.serializeSignature(signature)

        const mockReq = {
            method,
            path,
            headers: {
                authorization: `celo ${address}:${serializedSignature}`,
            },
            participantId: null,
        }
        const mockRes = null
        authCelo(mockReq, mockRes, () => {
            expect(mockReq.participantId).is.equal(address)
            done()
        })
    })

    let statusCode
    const mockRes = {
        status: (code): object => {
            statusCode = code
            return mockRes
        },
        json: (): object => mockRes,
    }

    it('rejects missing authorization', (done) => {
        const mockReq = {
            headers: {},
        }
        const mockNext = (err): void => {
            expect(statusCode).to.equal(400)
            expect(err).to.be.an('error')
            done()
        }
        authCelo(mockReq, mockRes, mockNext)
    })

    it('rejects non celo authorization', (done) => {
        const mockReq = {
            headers: {
                authorization: 'basic foo',
            },
        }
        const mockNext = (err): void => {
            expect(statusCode).to.equal(400)
            expect(err).to.be.an('error')
            done()
        }
        authCelo(mockReq, mockRes, mockNext)
    })

    it('rejects celo authorization missing credentials', (done) => {
        const mockReq = {
            headers: {
                authorization: 'celo',
            },
        }
        const mockNext = (err): void => {
            expect(statusCode).to.equal(400)
            expect(err).to.be.an('error')
            done()
        }
        authCelo(mockReq, mockRes, mockNext)
    })

    it('rejects invalid celo authorization', (done) => {
        const method = 'get'
        const path = '/flarb/snarg/bronb'
        const mockReq = {
            method,
            path,
            headers: {
                authorization: 'celo something',
            },
        }
        const mockNext = (err): void => {
            expect(statusCode).to.equal(401)
            expect(err).to.be.an('error')
            done()
        }
        authCelo(mockReq, mockRes, mockNext)
    })
})
