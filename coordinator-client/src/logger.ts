import Pino from 'pino'
import fs from 'fs'

const runningMocha = typeof global.it === 'function'

const pinoOptions: Pino.LoggerOptions = {
    name: 'coordinator-client',
}

if (process.env.LOG_LEVEL) {
    pinoOptions.level = process.env.LOG_LEVEL
} else if (runningMocha) {
    pinoOptions.level = 'warn'
} else {
    pinoOptions.level = 'info'
}

export let logFile

const logPath = process.env.LOG_FILE || 'snark-setup.log'
if (logPath === '-') {
    logFile = process.stdout
} else {
    logFile = fs.createWriteStream(logPath)
}

if (logFile.isTTY) {
    pinoOptions.prettyPrint = true
}

export const logger = Pino(pinoOptions, logFile)
