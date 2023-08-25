import Joi from 'joi'

import { logger } from './logger'
import { nimiqSignatureLength, signatureWith0xLength } from './signed-data'

export const challengeHashLength = 128
export const responseHashLength = 128

export interface SignedContributionData {
    data: {
        challengeHash: string
        responseHash: string
    }
    signature: string
}

export function isContributorData(
    data: object,
): data is SignedContributionData {
    const schema = Joi.object({
        data: Joi.object({
            challengeHash: Joi.string().length(challengeHashLength).required(),
            responseHash: Joi.string().length(challengeHashLength).required(),
        })
            .unknown(true)
            .required(),
        signature: Joi.alternatives().try(
            Joi.string().length(signatureWith0xLength).required(),
            Joi.string().length(nimiqSignatureLength).required(),
        ),
    })

    const validationResult = schema.validate(data)
    if (!validationResult.error) {
        return true
    } else {
        logger.error(
            `could not validate contributor data: error was ${
                validationResult.error
            }, value was ${JSON.stringify(data)}`,
        )
        return false
    }
}
