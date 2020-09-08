/**
 * Middleware for development that authenticates any request with type 'dummy'
 */
export function authDummy(req, res, next): void {
    let participantId
    try {
        if (!('authorization' in req.headers)) {
            throw new Error('Missing authorization header')
        }
        const authorization = req.headers.authorization

        const split = authorization.split(' ')
        const authorizationType = split[0]
        if (authorizationType.toLowerCase() !== 'dummy') {
            throw new Error(
                `Unexpected authorization type ${authorizationType}`,
            )
        }
        participantId = split[1]
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message,
        })
        next(error)
        return
    }

    req.participantId = participantId
    next()
}
