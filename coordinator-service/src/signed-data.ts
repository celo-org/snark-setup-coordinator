import Joi from 'joi'

import { logger } from './logger'

export const signatureWith0xLength = 132
export interface SignedData {
    data: object
    signature: string
}

export function isSignedData(body: object): body is SignedData {
    const schema = Joi.object({
        data: Joi.object({}).unknown(true).required(),
        signature: Joi.string().length(signatureWith0xLength).required(),
    })

    const validationResult = schema.validate(body)
    if (!validationResult.error) {
        return true
    } else {
        logger.error(
            `could not validate signed data: error was ${
                validationResult.error
            }, value was ${JSON.stringify(body)}`,
        )
        return false
    }
}
