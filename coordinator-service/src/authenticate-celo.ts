import express = require('express')
import { verifySignature, hashMessage } from '@celo/utils/lib/signatureUtils'

import { AuthenticateStrategy } from './authenticate'

/**
 * AuthenticateStrategy that authenticates a request using Celo accounts.
 *
 * @remarks
 * Uses the Authorization header in the following form:
 *   Authorizaton: Celo Account-Address:Signature
 * Signature signs a message of the following form: HTTP-Verb Request-Path
 **/
export class AuthenticateCelo implements AuthenticateStrategy {
    verify(req: express.Request): string {
        if (!('authorization' in req.headers)) {
            throw new Error('Missing authorization header')
        }
        const authorization = req.headers.authorization

        const [
            authorizationType,
            authorizationCredentials,
        ] = authorization.split(' ')
        if (authorizationType.toLowerCase() !== 'celo') {
            throw new Error(
                `Unexpected authorization type ${authorizationType}`,
            )
        } else if (!authorizationCredentials) {
            throw new Error('Missing authorization credentials')
        }

        const split = authorizationCredentials.split(':')
        const address = split[0]
        const serializedSignature = split[1]
        const message = `${req.method.toLowerCase()} ${req.path.toLowerCase()}`
        const verified = verifySignature(message, serializedSignature, address)
        if (!verified) {
            throw new Error('Invalid authorization')
        }
        const participantId = address
        return participantId
    }
    verifyMessage(data: object, signature: string, address: string): boolean {
        const message = JSON.stringify(data)
        return verifySignature(message, signature, address)
    }
}
