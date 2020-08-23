import express from 'express'

import { ChunkStorage, Coordinator } from './coordinator'
import { logger } from './logger'

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

export function initExpress({
    coordinator,
    chunkStorage,
}: {
    coordinator: Coordinator
    chunkStorage: ChunkStorage
}): express.Application {
    const app = express()

    app.get('/ceremony', (req, res) => {
        logger.info('GET /ceremony')
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
        logger.info(`POST /chunks/${chunkId}/lock ${participantId}`)
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
            logger.warn(err.message)
            res.status(400).json({ status: 'error', message: err.message })
        }
    })

    app.get('/chunks/:id/contribution', (req, res) => {
        const participantId = req.participantId
        const chunkId = req.params.id

        logger.info(`GET /chunks/${chunkId}/contribution ${participantId}`)
        const version = coordinator
            .getChunk(chunkId)
            .contributions.length.toString()
        const writeUrl = chunkStorage.getChunkWriteLocation({
            chunkId,
            participantId,
            version,
        })
        res.json({
            status: 'ok',
            result: {
                chunkId,
                participantId,
                writeUrl,
            },
        })
    })

    app.post('/chunks/:id/contribution', async (req, res) => {
        const participantId = req.participantId
        const chunkId = req.params.id

        logger.info(`POST /chunks/${chunkId}/contribution ${participantId}`)
        const version = coordinator
            .getChunk(chunkId)
            .contributions.length.toString()
        const readUrl = chunkStorage.getChunkReadLocation({
            chunkId,
            participantId,
            version,
        })
        try {
            await coordinator.contributeChunk(chunkId, participantId, readUrl)
            res.json({ status: 'ok' })
        } catch (err) {
            logger.warn(err.message)
            res.status(400).json({ status: 'error' })
        }
    })

    return app
}
