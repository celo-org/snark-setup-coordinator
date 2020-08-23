import * as fs from 'fs'

import { logger } from './logger'
import { ShellContributor } from './shell-contributor'
import {
    CeremonyParticipant,
    CeremonyContributor,
    CeremonyVerifier,
} from './ceremony-participant'

function sleep(msec): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, msec))
}

async function init({
    client,
    contributor,
}: {
    client: CeremonyParticipant
    contributor: ShellContributor
}): Promise<void> {
    const lockBackoffMsecs = 5000

    let incompleteChunks = await client.getChunksRemaining()
    while (incompleteChunks.length) {
        const ceremony = await client.getCeremony()
        const completedChunkCount =
            ceremony.chunks.length - incompleteChunks.length
        const remainingChunkIds = incompleteChunks.map(chunk => chunk.chunkId)
        logger.info(
            `completed ${completedChunkCount} / ${ceremony.chunks.length}`,
        )
        logger.info(
            `incomplete chunks: %o`, remainingChunkIds
        )
        const chunk = await client.getLockedChunk()
        if (chunk) {
            logger.info(`locked chunk ${chunk.chunkId}`)
            try {
                const contributionPath = await contributor.run(chunk)
                logger.info('uploading contribution %s', contributionPath)
                const content = fs.readFileSync(contributionPath).toString()
                await client.contributeChunk(chunk.chunkId, content)
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

const participantId = process.env.PARTICIPANT_ID || 'dave'
const mode = process.env.MODE || 'contribute'
const baseUrl = 'http://localhost:8080/'

let client
if (mode === 'contribute') {
    client = new CeremonyContributor({ participantId, baseUrl })
} else if (mode === 'verify') {
    client = new CeremonyVerifier({ participantId, baseUrl })
} else {
    logger.error(`Unexpected mode ${mode}`)
    process.exit(1)
}

const contributor = new ShellContributor({
    contributorCommand: './contributor/mock.sh',
    contributionBasePath: '/tmp',
})

init({ client, contributor }).catch((err) => {
    logger.error(err)
    process.exit(1)
})
