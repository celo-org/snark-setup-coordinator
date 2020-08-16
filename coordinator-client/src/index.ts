import * as fs from 'fs'

import { ShellContributor } from './shell-contributor'
import { CeremonyParticipant } from './ceremony-participant'

function sleep(msec): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, msec))
}

async function init(): Promise<void> {
    const participantId = process.env.PARTICIPANT_ID || 'dave'
    const baseUrl = 'http://localhost:8080/'
    const lockBackoffMsecs = 5000

    const client = new CeremonyParticipant(participantId, baseUrl)
    const contributor = new ShellContributor({
        contributorCommand: './contributor/mock.sh',
        contributionBasePath: '/tmp',
    })

    let ceremony = await client.getCeremony()
    console.log('Starting state:', JSON.stringify(ceremony, null, 2))

    let incompleteChunks = await client.getIncompleteChunks()
    while (incompleteChunks.length) {
        const completedChunkCount =
            ceremony.chunks.length - incompleteChunks.length
        console.log(
            `Completed ${completedChunkCount} / ${ceremony.chunks.length}`,
        )
        console.log(
            `Incomplete chunks:\n${JSON.stringify(incompleteChunks, null, 2)}`,
        )
        const chunk = await client.getLockedChunk()
        if (chunk) {
            console.log(`Locked chunk ${chunk.chunkId}`)
            try {
                const contributionPath = await contributor.run(chunk)
                console.log('contributionPath', contributionPath)
                const content = fs.readFileSync(contributionPath).toString()
                await client.contributeChunk(chunk.chunkId, content)
            } catch (error) {
                console.error('Contributor failed', error)
                // TODO(sbw)
                // await client.unlockChunk(chunk.chunkId)
            }
        } else {
            console.log('Unable to lock chunk')
        }
        await sleep(lockBackoffMsecs)
        incompleteChunks = await client.getIncompleteChunks()
    }

    ceremony = await client.getCeremony()
    console.log('Ending state:', JSON.stringify(ceremony, null, 2))
}

init().catch((err) => {
    console.error(err)
    process.exit(1)
})
