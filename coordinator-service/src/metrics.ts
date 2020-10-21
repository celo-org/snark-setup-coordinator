import prometheus = require('prom-client')
import express from 'express'

import { ReadonlyCeremony } from './ceremony'
import { Coordinator } from './coordinator'

export function initMetrics({
    coordinator,
}: {
    coordinator: Coordinator
}): express.Application {
    let ceremony: ReadonlyCeremony

    const registry = new prometheus.Registry()

    prometheus.collectDefaultMetrics({
        register: registry,
        prefix: 'coordinator_',
    })

    // prom-client@12.1.0 should include a collector interface:
    //  https://github.com/siimon/prom-client/commit/4e6aacd4921a3791e8f01ac6ab2fd6bb421b0dc0
    // Fake the interface for now.
    const collectors = []
    const ceremonyVersionInfo = new prometheus.Gauge({
        name: 'coordinator_ceremony_version_info',
        help: 'The latest version of the ceremony',
        registers: [registry],
    })
    collectors.push(
        function collect(): void {
            this.set(ceremony.version)
        }.bind(ceremonyVersionInfo),
    )

    const ceremonyLockInfo = new prometheus.Gauge({
        name: 'coordinator_ceremony_lock_info',
        help: 'The latest lock state',
        labelNames: ['chunkId'],
        registers: [registry],
    })
    collectors.push(
        function collect(): void {
            for (const chunk of ceremony.chunks) {
                this.set({ chunkId: chunk.chunkId }, chunk.lockHolder ? 1 : 0)
            }
        }.bind(ceremonyLockInfo),
    )

    const ceremonyLockTimestamp = new prometheus.Gauge({
        name: 'coordinator_ceremony_lock_timestamp',
        help: 'The latest lock modification time',
        labelNames: ['chunkId'],
        registers: [registry],
    })
    collectors.push(
        function collect(): void {
            for (const chunk of ceremony.chunks) {
                const date = new Date(chunk.metadata.lockHolderTime)
                this.set({ chunkId: chunk.chunkId }, date.valueOf())
            }
        }.bind(ceremonyLockTimestamp),
    )

    const app = express()
    app.get('/metrics', async (req, res) => {
        ceremony = coordinator.getCeremony()
        collectors.forEach((collector) => collector())

        res.set('Content-Type', prometheus.register.contentType)
        res.end(await registry.metrics())
    })

    return app
}
