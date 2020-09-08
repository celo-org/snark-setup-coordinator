import { SignatureUtils } from '@celo/utils/lib/signatureUtils'

import { Auth } from './auth'

export class AuthCelo implements Auth {
    address: string
    privateKey: string

    constructor({
        address,
        privateKey,
    }: {
        address: string
        privateKey: string
    }) {
        this.address = address
        if (!privateKey.startsWith('0x')) {
            privateKey = `0x${privateKey}`
        }
        this.privateKey = privateKey
    }

    getAuthorizationValue({
        method,
        path,
    }: {
        method: string
        path: string
    }): string {
        const message = `${method.toLowerCase()} ${path.toLowerCase()}`
        const signature = SignatureUtils.signMessage(
            message,
            this.privateKey,
            this.address,
        )
        const serializedSignature = SignatureUtils.serializeSignature(signature)
        return `Celo ${this.address}:${serializedSignature}`
    }
}
