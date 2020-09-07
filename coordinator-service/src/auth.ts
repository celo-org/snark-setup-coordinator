export function auth(req, res, next): void {
    if (!('x-participant-id' in req.headers)) {
        const error = new Error('Missing x-participant-id header')
        res.status(400).json({
            status: 'error',
            message: error.message,
        })
        next(error)
        return
    }
    req.participantId = req.headers['x-participant-id'] as string
    next()
}
