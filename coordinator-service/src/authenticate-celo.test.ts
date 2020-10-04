import { expect } from 'chai'
import express = require('express')
import { SignatureUtils } from '@celo/utils/lib/signatureUtils'

import { AuthenticateCelo } from './authenticate-celo'

describe('celoAuth', () => {
    const authCelo = new AuthenticateCelo()

    it('accepts valid authorization', () => {
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
        } as express.Request
        const participantId = authCelo.verify(mockReq)
        expect(participantId).is.equal(address)
    })

    it('rejects missing authorization', () => {
        const mockReq = {
            headers: {},
        } as express.Request
        expect(() => authCelo.verify(mockReq)).to.throw()
    })

    it('rejects non celo authorization', () => {
        const mockReq = {
            headers: {
                authorization: 'basic foo',
            },
        } as express.Request
        expect(() => authCelo.verify(mockReq)).to.throw()
    })

    it('rejects celo authorization missing credentials', () => {
        const mockReq = {
            headers: {
                authorization: 'celo',
            },
        } as express.Request
        expect(() => authCelo.verify(mockReq)).to.throw()
    })

    it('rejects invalid celo authorization', () => {
        const method = 'get'
        const path = '/flarb/snarg/bronb'
        const mockReq = {
            method,
            path,
            headers: {
                authorization: 'celo something',
            },
        } as express.Request
        expect(() => authCelo.verify(mockReq)).to.throw()
    })
})
