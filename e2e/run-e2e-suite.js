const path = require('path')
const { spawnSync } = require('child_process')

const debug = false

const createCluster = true
const deleteCluster = false
const dockerBuild = true
const runService = true
const runNewChallenge = true
const runContributor = true
const runVerifier = true

const clusterName = 'coordinator-cluster'
const kindConfig = path.join(__dirname, 'kind.yaml')
const kindImage = 'kindest/node:v1.16.15'
const kubeconfig = path.join(__dirname, '.kubeconfig')

const serviceYaml = path.join('coordinator-service', 'coordinator-service.yaml')
const serviceConfigMap = path.join(__dirname, 'coordinator-service-configmap.yaml')

const newChallengeYaml = path.join('coordinator-client', 'new-challenge-job.yaml')
const newChallengeConfigMap = path.join(__dirname, 'new-challenge-configmap.yaml')
const newChallengeSecret = path.join(__dirname, 'new-challenge-secret.yaml')

const contributorYaml = path.join('coordinator-client', 'contributor-job.yaml')
const contributorConfigMap = path.join(__dirname, 'contributor-configmap.yaml')
const contributorSecret = path.join(__dirname, 'contributor-secret.yaml')

const verifierYaml = path.join('coordinator-client', 'verifier-job.yaml')
const verifierConfigMap = path.join(__dirname, 'verifier-configmap.yaml')
const verifierSecret = path.join(__dirname, 'verifier-secret.yaml')

function run(command, args, options) {
  options = options || {}
  if (debug) console.log(`${command} \\\n  ${args.join(' \\\n  ')}`)
  const result = spawnSync(command, args, {stdio: 'inherit', ...options})
  if (result.status) {
    throw new Error(`${command} failed: ${result.status}`)
  } else if (result.signal) {
    throw new Error(`${command} exited from signal: ${result.signal}`)
  }
}

function kubectl(args, options) {
  options = options || {}
  options = {
    ...options,
    env: {
      KUBECONFIG: kubeconfig,
      ...process.env,
      ...options.env
    }
  }
  run('kubectl', args, options)
}

function kind(args, options) {
  args = [...args, '--name', clusterName]
  options = options || {}
  options = {
    ...options,
    env: {
      KUBECONFIG: kubeconfig,
      ...process.env,
      ...options.env
    }
  }
  run('kind', args, options)
}

function main() {
  const exitHandler = () => {
    if (deleteCluster) {
      kind(['delete', 'cluster'])
    }
  }
  process.on('exit', exitHandler)

  if (createCluster) {
    kind(['create', 'cluster',
          '--verbosity', '4',
          '--config', kindConfig,
          '--image', kindImage])
  }

  if (dockerBuild) {
    run('docker',
        ['build', '-t', 'coordinator-service:test', '.'],
        {stdio: 'inherit', cwd: 'coordinator-service'})
    run('docker',
        ['build', '-t', 'coordinator-client:test', '.'],
        {stdio: 'inherit', cwd: 'coordinator-client'})
    kind(['load', 'docker-image', '--name', clusterName, 'coordinator-service:test'])
    kind(['load', 'docker-image', '--name', clusterName, 'coordinator-client:test'])
  }
  
  if (runService) {
    kubectl(['apply', '-f', serviceConfigMap])
    kubectl(['apply', '-f', serviceYaml])
  }

  try {
    if (runNewChallenge) {
      kubectl(['apply', '-f', newChallengeSecret])
      kubectl(['apply', '-f', newChallengeConfigMap])
      kubectl(['apply', '-f', newChallengeYaml])
      kubectl(['wait', '--for=condition=complete', '--timeout=30s', 'job/new-challenge'])
    }

    if (runContributor) {
      kubectl(['apply', '-f', contributorSecret])
      kubectl(['apply', '-f', contributorConfigMap])
      kubectl(['apply', '-f', contributorYaml])
      kubectl(['wait', '--for=condition=complete', '--timeout=60s', 'job/contributor'])
    }

    if (runVerifier) {
      kubectl(['apply', '-f', verifierSecret])
      kubectl(['apply', '-f', verifierConfigMap])
      kubectl(['apply', '-f', verifierYaml])
      kubectl(['wait', '--for=condition=complete', '--timeout=60s', 'job/verifier'])
    }
  } catch (err) {
    console.log('## pods')
    kubectl(['get', 'pods'])
    console.log('## new-challenge logs')
    kubectl(['logs', '-l', 'app=new-challenge'])
    console.log('## contributor logs')
    kubectl(['logs', '-l', 'app=contributor'])
    console.log('## verifier logs')
    kubectl(['logs', '-l', 'app=verifier'])
    throw err
  }
}

try {
  main()
} catch(err) {
  console.log(err)
  process.exit(1)
}
