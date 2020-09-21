import bodyParser from 'body-parser'
import express from 'express'

import { ChunkStorage, Coordinator } from './coordinator'
import { logger } from './logger'

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        export interface Request {
            participantId?: string
        }
    }
}

export function initExpress({
    auth,
    coordinator,
    chunkStorage,
}: {
    auth: (req, res, next) => void
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

    app.put('/ceremony', auth, bodyParser.json(), (req, res) => {
        const ceremony = req.body
        logger.info('PUT /ceremony')
        try {
            coordinator.setCeremony(ceremony)
            res.json({
                status: 'ok',
            })
        } catch (err) {
            logger.warn(err.message)
            res.status(409).json({ status: 'error', message: err.message })
        }
    })

    app.post('/chunks/:id/lock', auth, (req, res) => {
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

    app.get('/chunks/:id/contribution', auth, (req, res) => {
        const participantId = req.participantId
        const chunkId = req.params.id

        logger.info(`GET /chunks/${chunkId}/contribution ${participantId}`)
        const chunk = coordinator.getChunk(chunkId)
        const writeUrl = chunkStorage.getChunkWriteLocation({
            chunk,
            participantId,
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

    app.post('/chunks/:id/contribution', auth, async (req, res) => {
        const participantId = req.participantId
        const chunkId = req.params.id

        logger.info(`POST /chunks/${chunkId}/contribution ${participantId}`)
        const chunk = coordinator.getChunk(chunkId)

        let url
        try {
            url = await chunkStorage.copyChunk({
                chunk,
                participantId,
            })
        } catch (err) {
            logger.warn(err.message)
            res.status(400).json({
                status: 'error',
                message: 'Unable to copy contribution',
            })
            return
        }

        try {
            await coordinator.contributeChunk(chunkId, participantId, url)
            res.json({ status: 'ok' })
        } catch (err) {
            logger.warn(err.message)
            res.status(400).json({ status: 'error' })
        }
    })

    return app
}
