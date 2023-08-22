import Nimiq = require('@nimiq/core')

import { Auth } from './auth'
import { assert } from 'console'

export class AuthNimiq implements Auth {
    keyPair: Nimiq.KeyPair

    constructor(keyPair: Nimiq.KeyPair) {
        this.keyPair = keyPair
    }

    static fromString({
        publicKey,
        keyPair,
    }: {
        publicKey: string
        keyPair: string
    }) {
        const kp = Nimiq.KeyPair.fromHex(keyPair)
        const pk = Nimiq.PublicKey.fromAny(publicKey)

        assert(kp.publicKey == pk)
        return new AuthNimiq(kp)
    }

    getAuthorizationValue({
        method,
        path,
    }: {
        method: string
        path: string
    }): string {
        const message = `${method.toLowerCase()} ${path.toLowerCase()}`
        const serializedSignature = this.signMessage(message)
        return `Nimiq ${this.keyPair.publicKey.toHex()}:${serializedSignature}`
    }

    signMessage(message: string): string {
        const signature = Nimiq.Signature.create(
            this.keyPair.privateKey,
            this.keyPair.publicKey,
            Nimiq.BufferUtils.fromAscii(message),
        )
        const serializedSignature = signature.toHex()
        return serializedSignature
    }
}
