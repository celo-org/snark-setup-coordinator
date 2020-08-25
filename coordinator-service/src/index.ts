import yargs = require('yargs')
import bodyParser from 'body-parser'
import fs from 'fs'
import { StorageSharedKeyCredential } from '@azure/storage-blob'

import { BlobChunkStorage } from './blob-chunk-storage'
import { ChunkStorage } from './coordinator'
import { DiskCoordinator } from './disk-coordinator'
import { DiskChunkStorage } from './disk-chunk-storage'
import { initExpress } from './app'
import { logger } from './logger'

const argv = yargs
    .env('COORDINATOR')
    .option('port', {
        default: 8080,
        type: 'number',
    })
    .option('db-file', {
        default: './.storage/db.json',
        type: 'string',
    })
    .option('chunk-storage-type', {
        choices: ['disk', 'azure'],
        default: 'disk',
        type: 'string',
    })
    .option('disk-chunk-storage-directory', {
        default: './.storage',
        type: 'string',
    })
    .option('azure-access-key-file', {
        type: 'string',
        describe: 'File with storage account access key',
    })
    .option('azure-storage-account', {
        type: 'string',
        describe: 'Azure storage account',
    })
    .option('azure-container', {
        type: 'string',
        describe: 'Azure container name to write contributions to',
    })
    .help().argv

function main(args): void {
    logger.info('invoked with args %o', args)

    let diskChunkStorage
    let chunkStorage: ChunkStorage
    if (args.chunkStorageType === 'disk') {
        const chunkStorageUrl = `http://localhost:${args.port}/chunks`
        diskChunkStorage = new DiskChunkStorage({
            storagePath: args.diskChunkStorageDirectory,
            chunkStorageUrl,
        })
        chunkStorage = diskChunkStorage
    } else if (args.chunkStorageType === 'azure') {
        const sharedKeyCredential = new StorageSharedKeyCredential(
            args.azureStorageAccount,
            fs.readFileSync(args.azureAccessKeyFile).toString(),
        )
        chunkStorage = new BlobChunkStorage({
            containerName: args.azureContainer,
            sharedKeyCredential,
        })
    }

    const coordinator = new DiskCoordinator({ dbPath: args.dbFile })
    const app = initExpress({ coordinator, chunkStorage })

    if (args.chunkStorageType === 'disk') {
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
    }

    app.listen(args.port, () => {
        logger.info(`listening on ${args.port}`)
    })
}

main(argv)
