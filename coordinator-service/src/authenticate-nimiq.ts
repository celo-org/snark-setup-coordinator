import express = require('express')
import Nimiq = require('@nimiq/core')

import { AuthenticateStrategy } from './authenticate'

/**
 * AuthenticateStrategy that authenticates a request using Nimiq accounts.
 *
 * @remarks
 * Uses the Authorization header in the following form:
 *   Authorizaton: Nimiq Account-PublicKey:Signature
 * Signature signs a message of the following form: HTTP-Verb Request-Path
 **/
export class AuthenticateNimiq implements AuthenticateStrategy {
    verify(req: express.Request): string {
        if (!('authorization' in req.headers)) {
            throw new Error('Missing authorization header')
        }
        const authorization = req.headers.authorization

        const [
            authorizationType,
            authorizationCredentials,
        ] = authorization.split(' ')
        if (authorizationType.toLowerCase() !== 'nimiq') {
            throw new Error(
                `Unexpected authorization type ${authorizationType}`,
            )
        } else if (!authorizationCredentials) {
            throw new Error('Missing authorization credentials')
        }

        const split = authorizationCredentials.split(':')
        const publicKey = Nimiq.PublicKey.fromAny(split[0])
        const signature = Nimiq.Signature.fromAny(split[1])
        const message = `${req.method.toLowerCase()} ${req.path.toLowerCase()}`
        const verified = signature.verify(
            publicKey,
            Nimiq.BufferUtils.fromAscii(message),
        )
        if (!verified) {
            throw new Error('Invalid authorization')
        }
        const participantId = publicKey.toHex()
        return participantId
    }
    verifyMessage(
        data: object,
        serializedSignature: string,
        serializedPublicKey: string,
    ): boolean {
        const publicKey = Nimiq.PublicKey.fromAny(serializedPublicKey)
        const signature = Nimiq.Signature.fromAny(serializedSignature)
        const message = JSON.stringify(data)
        return signature.verify(publicKey, Nimiq.BufferUtils.fromAscii(message))
    }
    verifyString(
        data: string,
        serializedSignature: string,
        serializedPublicKey: string,
    ): boolean {
        const publicKey = Nimiq.PublicKey.fromAny(serializedPublicKey)
        const signature = Nimiq.Signature.fromAny(serializedSignature)
        return signature.verify(publicKey, Nimiq.BufferUtils.fromAscii(data))
    }
}
