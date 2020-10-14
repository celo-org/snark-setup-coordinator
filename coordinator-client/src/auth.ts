export interface Auth {
    getAuthorizationValue({
        method,
        path,
    }: {
        method: string
        path: string
    }): string
    signMessage(message: string): string
}
