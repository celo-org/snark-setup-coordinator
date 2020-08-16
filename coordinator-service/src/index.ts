import { initExpress } from './app'
import { DiskCoordinator } from './disk-coordinator'
import { DiskChunkStorage } from './disk-chunk-storage'

const port = process.env.PORT || 8080
const storagePath = process.env.STORAGE_PATH || './.storage'
const dbPath = process.env.DB_PATH || './.storage/db.json'

const chunkStorage = new DiskChunkStorage(storagePath)
const coordinator = new DiskCoordinator({ chunkStorage, dbPath })
const app = initExpress(coordinator)

app.listen(port, () => {
    console.log(`Listening on ${port}`)
})
