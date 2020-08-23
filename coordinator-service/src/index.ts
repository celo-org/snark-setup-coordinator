import bodyParser from 'body-parser'

import { initExpress } from './app'
import { DiskCoordinator } from './disk-coordinator'
import { DiskChunkStorage } from './disk-chunk-storage'
import { logger } from './logger'

const port = process.env.PORT || 8080
const storagePath = process.env.STORAGE_PATH || './.storage'
const dbPath = process.env.DB_PATH || './.storage/db.json'

const chunkStorageUrl = `http://localhost:${port}/chunks`
const diskChunkStorage = new DiskChunkStorage({ storagePath, chunkStorageUrl })
const coordinator = new DiskCoordinator({
    chunkStorage: diskChunkStorage,
    dbPath,
})
const app = initExpress({ coordinator, chunkStorage: diskChunkStorage })

//
// For local development, etc.
//
app.use(bodyParser.raw())
app.post('/chunks/:chunkId/contribution/:version', async (req, res) => {
    const participantId = req.participantId
    const chunkId = req.params.chunkId
    const version = req.params.version
    const content = req.body.toString()

    logger.info(`POST /chunks/${chunkId}/contribution/${version}`)
    try {
        await diskChunkStorage.setChunk(
            chunkId,
            participantId,
            version,
            content,
        )
        res.json({ status: 'ok' })
    } catch (err) {
        res.status(400).json({ status: 'error', message: err.message })
    }
})

app.listen(port, () => {
    logger.info(`listening on ${port}`)
})
