export class ContributionData {
    challengeHash: string
    responseHash: string
}

export class SignedContributionData {
    data: ContributionData
    signature: string
}
