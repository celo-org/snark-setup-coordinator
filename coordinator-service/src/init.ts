import fs from 'fs'
import path from 'path'

import { DiskCoordinator } from './disk-coordinator'
import { logger } from './logger'

const dbPath = process.env.COORDINATOR_DB_FILE || './.storage/db.json'
const configPath =
    process.env.COORDINATOR_CONFIG_PATH || './ceremony/simple.json'

async function init(): Promise<void> {
    const storagePath = path.dirname(dbPath)
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
