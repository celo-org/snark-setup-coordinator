import Pino from 'pino'

const runningMocha = typeof global.it === 'function'

let prettyPrint = true
if (process.env.JSON_LOGGING) {
    prettyPrint = false
}

export const logger = Pino({
    name: 'coordinator-service',
    prettyPrint,
    level: runningMocha ? 'warn' : 'info',
})
