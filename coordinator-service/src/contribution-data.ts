import Joi from 'joi'

import { logger } from './logger'
import { signatureWith0xLength } from './signed-data'

export const challengeHashLength = 128
export const responseHashLength = 128

export class ContributionData {
    challengeHash: string
    responseHash: string
}

export class SignedContributionData {
    data: ContributionData
    signature: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isContributorData(data: any): data is SignedContributionData {
    const schema = Joi.object({
        data: Joi.object({
            challengeHash: Joi.string().length(challengeHashLength).required(),
            responseHash: Joi.string().length(challengeHashLength).required(),
        })
            .unknown(true)
            .required(),
        signature: Joi.string().length(signatureWith0xLength).required(),
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
