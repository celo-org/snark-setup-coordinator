import fs from 'fs'
import { ChunkData, CeremonyParameters } from './ceremony'
import { CeremonyParticipant } from './ceremony-participant'
import { ShellCommand } from './shell-contributor'
import { logger } from './logger'
import { SignedData } from './signed-data'

function sleep(msec): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, msec))
}

export async function worker({
    client,
    contributor,
}: {
    client: CeremonyParticipant
    contributor: (
        parameters: CeremonyParameters,
        chunk: ChunkData,
    ) => ShellCommand
}): Promise<void> {
    const lockBackoffMsecs = 5000

    let incompleteChunks = await client.getChunksRemaining()
    while (incompleteChunks.length) {
        const ceremony = await client.getCeremony()
        const completedChunkCount =
            ceremony.chunks.length - incompleteChunks.length
        const remainingChunkIds = incompleteChunks.map((chunk) => chunk.chunkId)
        logger.info(
            `completed ${completedChunkCount} / ${ceremony.chunks.length}`,
        )
        logger.info(`incomplete chunks: %o`, remainingChunkIds)
        const chunk = await client.getLockedChunk()
        if (chunk) {
            logger.info(`locked chunk ${chunk.chunkId}`)
            try {
                // TODO: pull up out of if and handle errors
                const contribute = contributor(ceremony.parameters, chunk)
                await contribute.load()

                const { contributionPath, result } = await contribute.run()
                const signature = client.auth.signMessage(
                    JSON.stringify(result),
                )
                const signedContributionData: SignedData = {
                    data: result,
                    signature,
                }
                logger.info(
                    'uploading contribution %s with data %s',
                    contributionPath,
                    JSON.stringify(signedContributionData),
                )
                const content = fs.readFileSync(contributionPath)
                await client.contributeChunk({
                    chunkId: chunk.chunkId,
                    content,
                    signedData: signedContributionData,
                })

                contribute.cleanup()
            } catch (error) {
                logger.warn(error, 'contributor failed')
                // TODO(sbw)
                // await client.unlockChunk(chunk.chunkId)
            }
        } else {
            logger.info('unable to lock chunk')
        }
        await sleep(lockBackoffMsecs)
        incompleteChunks = await client.getChunksRemaining()
    }

    logger.info('no more chunks remaining')
}
