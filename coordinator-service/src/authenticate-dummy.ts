import express = require('express')

import { AuthenticateStrategy } from './authenticate'

export class AuthenticateDummy implements AuthenticateStrategy {
    verify(req: express.Request): string {
        if (!('authorization' in req.headers)) {
            throw new Error('Missing authorization header')
        }
        const authorization = req.headers.authorization

        const split = authorization.split(' ')
        const authorizationType = split[0]
        if (authorizationType.toLowerCase() !== 'dummy') {
            throw new Error(
                `Unexpected authorization type ${authorizationType}`,
            )
        }
        const participantId = split[1]
        return participantId
    }
}
