import * as fs from 'fs'

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

    let ceremony = await client.getCeremony()
    console.log('Starting state:', JSON.stringify(ceremony, null, 2))

    let incompleteChunks = await client.getChunksRemaining()
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
        incompleteChunks = await client.getChunksRemaining()
    }

    ceremony = await client.getCeremony()
    console.log('Ending state:', JSON.stringify(ceremony, null, 2))
}

const participantId = process.env.PARTICIPANT_ID || 'dave'
const mode = process.env.MODE || 'contribute'
const baseUrl = 'http://localhost:8080/'

let client
if (mode === 'contribute') {
    client = new CeremonyContributor(participantId, baseUrl)
} else if (mode === 'verify') {
    client = new CeremonyVerifier(participantId, baseUrl)
} else {
    console.error(`Unexpected mode ${mode}`)
    process.exit(1)
}

const contributor = new ShellContributor({
    contributorCommand: './contributor/mock.sh',
    contributionBasePath: '/tmp',
})

init({ client, contributor }).catch((err) => {
    console.error(err)
    process.exit(1)
})
