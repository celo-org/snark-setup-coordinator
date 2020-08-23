import Pino from 'pino'

const runningMocha = typeof global.it === 'function'

export const logger = Pino({
    name: 'coordinator-service',
    prettyPrint: true,
    level: runningMocha ? 'warn' : 'info',
})
