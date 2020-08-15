import fs from 'fs'

import { DiskCoordinator } from './disk-coordinator'

async function init(configPath, dbPath): Promise<void> {
    const config = JSON.parse(fs.readFileSync(configPath).toString())
    DiskCoordinator.init({ config, dbPath })
}

init(process.env.CONFIG_PATH, process.env.DB_PATH || 'db.json').catch((err) => {
    console.error(err)
    process.exit(1)
})
