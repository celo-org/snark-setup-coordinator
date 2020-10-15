import fs from 'fs'
import ora from 'ora'
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
    const ui = ora('Starting to contribute...').start()
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
        ui.text = `Waiting for an available chunk... Completed ${completedChunkCount} / ${ceremony.chunks.length}`
        logger.info(`incomplete chunks: %o`, remainingChunkIds)
        const chunk = await client.getLockedChunk()
        if (chunk) {
            ui.text = `Contributing to chunk ${chunk.chunkId}... Completed ${completedChunkCount} / ${ceremony.chunks.length}`
            logger.info(`locked chunk ${chunk.chunkId}`)
            try {
                // TODO: pull up out of if and handle errors
                const contribute = contributor(ceremony.parameters, chunk)
                await contribute.load()

                const { contributionPath, result } = await contribute.run()
                const signature = client.auth.signMessage(
                    JSON.stringify(result),
                )
                logger.info(`signing: %s`, JSON.stringify(result))
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

    ui.succeed(`Your contribution was done, thanks for participating!`)
    logger.info('no more chunks remaining')
}
