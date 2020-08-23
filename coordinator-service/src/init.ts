import fs from 'fs'

import { DiskCoordinator } from './disk-coordinator'
import { logger } from './logger'

const storagePath = process.env.STORAGE_PATH || './.storage'
const dbPath = process.env.DB_PATH || './.storage/db.json'
const configPath = process.env.CONFIG_PATH || './ceremony/simple.json'

async function init(): Promise<void> {
    try {
        fs.mkdirSync(storagePath, { recursive: true })
    } catch (error) {
        if (error.code !== 'EEXIST') {
            throw error
        }
    }

    const config = JSON.parse(fs.readFileSync(configPath).toString())
    DiskCoordinator.init({ config, dbPath })
}

init().catch((err) => {
    logger.error(err)
    process.exit(1)
})
