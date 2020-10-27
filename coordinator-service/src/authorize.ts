import { Coordinator } from './coordinator'
import { logger } from './logger'

/**
 * Return a middleware that authorizes requests based on `groups`.
 *
 * @remarks
 * If participantId is in one of the groups specified, authorize, otherwise
 * reject.
 */
export function authorize({
    coordinator,
    groups,
}: {
    coordinator: Coordinator
    groups: string[]
}): (req, res, next) => void {
    return function (req, res, next): void {
        const participantId = req.participantId
        const ceremony = coordinator.getCeremony()
        for (const group of groups) {
            if (ceremony[group].includes(participantId)) {
                next()
                return
            }
        }

        const err = new Error(`Not authorized for ${req.path}`)
        logger.warn(err.message)
        res.status(403).json({
            status: 'error',
            message: err.message,
        })
        next(err)
    }
}
