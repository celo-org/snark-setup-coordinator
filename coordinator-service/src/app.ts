import bodyParser from 'body-parser'
import express from 'express'

import { authenticate, AuthenticateStrategy } from './authenticate'
import { authorize } from './authorize'
import { ChunkStorage, Coordinator } from './coordinator'
import { logger } from './logger'
import { isSignedData } from './signed-data'

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        export interface Request {
            participantId?: string
        }
    }
}

export function initExpress({
    authenticateStrategy,
    coordinator,
    chunkStorage,
}: {
    authenticateStrategy: AuthenticateStrategy
    coordinator: Coordinator
    chunkStorage: ChunkStorage
}): express.Application {
    const app = express()
    const allowParticipants = authorize({
        coordinator,
        groups: ['verifierIds', 'contributorIds'],
    })
    const allowVerifiers = authorize({
        coordinator,
        groups: ['verifierIds'],
    })

    const authenticateRequests = authenticate(authenticateStrategy)

    app.get('/ceremony', (req, res) => {
        logger.debug('GET /ceremony')
        res.json({
            result: coordinator.getCeremony(),
            status: 'ok',
        })
    })

    app.put(
        '/ceremony',
        authenticateRequests,
        allowVerifiers,
        bodyParser.json({ limit: '1000mb' }),
        (req, res) => {
            const ceremony = req.body
            logger.debug('PUT /ceremony')
            try {
                coordinator.setCeremony(ceremony)
                res.json({
                    status: 'ok',
                })
            } catch (err) {
                logger.warn(err.message)
                res.status(409).json({ status: 'error', message: err.message })
            }
        },
    )

    app.get('/contributor/:id/chunks', (req, res) => {
        const participantId = req.params.id
        logger.debug(`GET /contributor/${participantId}/chunks`)
        try {
            const chunks = coordinator.getContributorChunks(participantId)
            const numNonContributed = coordinator.getNumNonContributedChunks(
                participantId,
            )
            const numChunks = coordinator.getNumChunks()
            const parameters = coordinator.getParameters()
            const maxLocks = coordinator.getMaxLocks()
            const shutdownSignal = coordinator.getShutdownSignal()
            res.json({
                status: 'ok',
                result: {
                    chunks,
                    numNonContributed,
                    parameters,
                    numChunks,
                    maxLocks,
                    shutdownSignal,
                },
            })
        } catch (err) {
            logger.warn(err.message)
            res.status(400).json({ status: 'error', message: err.message })
        }
    })

    app.get('/verifier/chunks', (req, res) => {
        logger.debug(`GET /verifier/chunks`)
        try {
            const chunks = coordinator.getVerifierChunks()
            const numNonContributed = chunks.length
            const numChunks = coordinator.getNumChunks()
            const parameters = coordinator.getParameters()
            const maxLocks = coordinator.getMaxLocks()
            const shutdownSignal = coordinator.getShutdownSignal()
            res.json({
                status: 'ok',
                result: {
                    chunks,
                    numNonContributed,
                    parameters,
                    numChunks,
                    maxLocks,
                    shutdownSignal,
                },
            })
        } catch (err) {
            logger.warn(err.message)
            res.status(400).json({ status: 'error', message: err.message })
        }
    })

    app.post(
        '/chunks/:id/lock',
        authenticateRequests,
        allowParticipants,
        (req, res) => {
            const participantId = req.participantId
            const chunkId = req.params.id
            logger.debug(`POST /chunks/${chunkId}/lock ${participantId}`)
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
        },
    )

    app.get('/chunks/:id/info', (req, res) => {
        const chunkId = req.params.id
        logger.debug(`GET /chunks/${chunkId}/info`)
        try {
            const chunk = coordinator.getChunkDownloadInfo(chunkId)
            res.json({
                status: 'ok',
                result: chunk,
            })
        } catch (err) {
            logger.warn(err.message)
            res.status(400).json({ status: 'error', message: err.message })
        }
    })

    app.post(
        '/chunks/:id/unlock',
        authenticateRequests,
        allowParticipants,
        (req, res) => {
            const participantId = req.participantId
            const chunkId = req.params.id
            logger.debug(`POST /chunks/${chunkId}/unlock ${participantId}`)
            try {
                const unlocked = coordinator.tryUnlockChunk(
                    chunkId,
                    participantId,
                )
                res.json({
                    status: 'ok',
                    result: {
                        chunkId,
                        unlocked,
                    },
                })
            } catch (err) {
                logger.warn(err.message)
                res.status(400).json({ status: 'error', message: err.message })
            }
        },
    )

    app.get(
        '/chunks/:id/contribution',
        authenticateRequests,
        allowParticipants,
        (req, res) => {
            const participantId = req.participantId
            const chunkId = req.params.id

            logger.debug(`GET /chunks/${chunkId}/contribution ${participantId}`)
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
        },
    )

    app.post(
        '/chunks/:id/contribution',
        authenticateRequests,
        allowParticipants,
        bodyParser.json(),
        async (req, res) => {
            const participantId = req.participantId
            const chunkId = req.params.id

            logger.debug(
                `POST /chunks/${chunkId}/contribution ${participantId}`,
            )
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
                const body = req.body
                if (!isSignedData(body)) {
                    throw new Error(
                        `Body should have been signed data: ${JSON.stringify(
                            body,
                        )}`,
                    )
                }
                const { data, signature } = body
                if (
                    !authenticateStrategy.verifyMessage(
                        data,
                        signature,
                        participantId,
                    )
                ) {
                    throw new Error('Could not verify signed data')
                }
                await coordinator.contributeChunk({
                    chunkId,
                    participantId,
                    location: url,
                    signedData: body,
                })
                res.json({ status: 'ok' })
            } catch (err) {
                logger.warn(err.message)
                res.status(400).json({ status: 'error' })
            }
        },
    )

    app.post(
        '/shutdown-signal',
        authenticateRequests,
        allowVerifiers,
        bodyParser.json(),
        (req, res) => {
            logger.debug('POST /shutdown-signal')
            try {
                coordinator.setShutdownSignal(req.body.signal)
                res.json({
                    status: 'ok',
                })
            } catch (err) {
                logger.warn(err.message)
                res.status(400).json({ status: 'error', message: err.message })
            }
        },
    )

    return app
}
