import fs from 'fs'
import { ChunkData, CeremonyParameters } from './ceremony'
import { CeremonyParticipant } from './ceremony-participant'
import { ShellCommand } from './shell-contributor'
import { logger } from './logger'

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

                const contributionPath = await contribute.run()
                logger.info('uploading contribution %s', contributionPath)
                const content = fs.readFileSync(contributionPath)
                await client.contributeChunk(chunk.chunkId, content)

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
