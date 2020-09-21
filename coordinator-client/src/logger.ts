import Pino from 'pino'

const runningMocha = typeof global.it === 'function'

let level
if (process.env.LOG_LEVEL) {
    level = process.env.LOG_LEVEL
} else if (runningMocha) {
    level = 'warn'
} else {
    level = 'info'
}

export const logger = Pino({
    name: 'coordinator-service',
    prettyPrint: true,
    level
})
