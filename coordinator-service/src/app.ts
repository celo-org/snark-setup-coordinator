import bodyParser from 'body-parser'
import express from 'express'

import { Coordinator } from './coordinator'

//
// POC: coordinates chunk contributions
// No verification, no auth, allows locking multiple chunks, no lock timeout, ...
//

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        export interface Request {
            participantId?: string
        }
    }
}

export function initExpress(coordinator: Coordinator): express.Application {
    const app = express()

    app.use(bodyParser.raw())

    app.get('/ceremony', (req, res) => {
        console.log('GET /ceremony')
        res.json({
            result: coordinator.getCeremony(),
            status: 'ok',
        })
    })

    // Lame fake authentication middleware
    app.use((req, res, next) => {
        if (!('x-participant-id' in req.headers)) {
            const error = new Error('Missing x-participant-id header')
            res.status(400).json({
                status: 'error',
                message: error.message,
            })
            next(error)
        }
        req.participantId = req.headers['x-participant-id'] as string
        next()
    })

    app.post('/chunks/:id/lock', (req, res) => {
        const participantId = req.participantId
        const chunkId = req.params.id
        console.log(`POST /chunks/${chunkId}/lock ${participantId}`)
        try {
            const locked = coordinator.tryLockChunk(chunkId, participantId)
            res.json({
                status: 'ok',
                result: {
                    chunkId,
                    locked,
                },
            })
        } catch (err) {
            console.warn(err.message)
            res.status(400).json({ status: 'error', message: err.message })
        }
    })

    app.post('/chunks/:id/contribution', async (req, res) => {
        const participantId = req.participantId
        const chunkId = req.params.id

        console.log(`POST /chunks/${chunkId}/contribution ${participantId}`)
        try {
            await coordinator.contributeChunk(
                chunkId,
                participantId,
                req.body.toString(),
            )
            res.json({ status: 'ok' })
        } catch (err) {
            console.warn(err.message)
            res.status(400).json({ status: 'error' })
        }
    })

    return app
}
