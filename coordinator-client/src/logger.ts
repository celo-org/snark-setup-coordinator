import Pino from 'pino'
import fs from 'fs'

const runningMocha = typeof global.it === 'function'

let level
if (process.env.LOG_LEVEL) {
    level = process.env.LOG_LEVEL
} else if (runningMocha) {
    level = 'warn'
} else {
    level = 'info'
}

export const logFile = fs.createWriteStream('snark-setup.log')

export const logger = Pino(
    {
        name: 'coordinator-service',
        prettyPrint: true,
        level,
    },
    logFile,
)
