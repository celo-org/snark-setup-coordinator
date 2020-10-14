import Joi from 'joi'

import { logger } from './logger'

export const signatureWith0xLength = 132
export class SignedData {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any
    signature: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isSignedData(body: any): body is SignedData {
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
