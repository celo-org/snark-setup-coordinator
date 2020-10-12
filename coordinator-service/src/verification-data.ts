export class VerificationData {
    challengeHash: string
    responseHash: string
    newChallengeHash: string
}

export class SignedVerificationData {
    data: VerificationData
    signature: string
}
