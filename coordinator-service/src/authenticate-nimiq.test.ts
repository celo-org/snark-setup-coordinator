import { expect } from 'chai'
import express = require('express')
import Nimiq = require('@nimiq/core')

import { AuthenticateNimiq } from './authenticate-nimiq'

describe('nimiqAuth', () => {
    const authNimiq = new AuthenticateNimiq()

    it('accepts valid authorization', () => {
        const method = 'get'
        const path = '/flarb/snarg/bronb'
        const keyPair = Nimiq.KeyPair.fromHex(
            '08d33c328ce2b13c4237a87eb6ac643ad88ed7481cf3a6c61a2f9d72f25d6e399ef5c4a6a4d3762e54b5bf47c9e8a55525ef7956eea59a7cf9a5448a29f93c0b00',
        )
        const message = `${method} ${path}`
        const signature = Nimiq.Signature.create(
            keyPair.privateKey,
            keyPair.publicKey,
            Nimiq.BufferUtils.fromAscii(message),
        )
        const serializedSignature = signature.toHex()

        const mockReq = {
            method,
            path,
            headers: {
                authorization: `nimiq ${keyPair.publicKey}:${serializedSignature}`,
            },
            participantId: null,
        } as express.Request
        const participantId = authNimiq.verify(mockReq)
        expect(participantId).is.equal(keyPair.publicKey.toHex())
    })

    it('rejects missing authorization', () => {
        const mockReq = {
            headers: {},
        } as express.Request
        expect(() => authNimiq.verify(mockReq)).to.throw()
    })

    it('rejects non nimiq authorization', () => {
        const mockReq = {
            headers: {
                authorization: 'basic foo',
            },
        } as express.Request
        expect(() => authNimiq.verify(mockReq)).to.throw()
    })

    it('rejects nimiq authorization missing credentials', () => {
        const mockReq = {
            headers: {
                authorization: 'nimiq',
            },
        } as express.Request
        expect(() => authNimiq.verify(mockReq)).to.throw()
    })

    it('rejects invalid nimiq authorization', () => {
        const method = 'get'
        const path = '/flarb/snarg/bronb'
        const mockReq = {
            method,
            path,
            headers: {
                authorization: 'nimiqs something',
            },
        } as express.Request
        expect(() => authNimiq.verify(mockReq)).to.throw()
    })
})
