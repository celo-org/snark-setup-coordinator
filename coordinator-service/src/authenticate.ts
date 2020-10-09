import express = require('express')

export interface AuthenticateStrategy {
    /**
     * Verify a request. Return the Participant ID or throw an Error.
     */

    verify(req: express.Request): string
}

export function authenticate(
    strategy: AuthenticateStrategy,
): (req, res, next) => void {
    return function (req, res, next): void {
        try {
            req.participantId = strategy.verify(req)
        } catch (error) {
            res.status(401).json({
                status: 'error',
                message: error.message,
            })
            next(error)
            return
        }
        next()
    }
}
