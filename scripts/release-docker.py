# Make sure you configure GCR for your local docker engine
# https://cloud.google.com/container-registry/docs/pushing-and-pulling

import click
from subprocess import Popen, PIPE
import sys 

@click.group()
@click.option('--debug/--no-debug', default=False)
def cli(debug):
    click.echo('Debug mode is %s' % ('on' if debug else 'off'))

@cli.command()  
@click.option('--repo', default="us.gcr.io/celo-testnet")
@click.option('--tag', default="test")
@click.option('--client-path', default="./coordinator-client")
@click.option('--service-path', default="./coordinator-service")
def release_docker(repo, tag, client_path, service_path):
    # Build and push Service
    coordinator_command = f'docker build -f {service_path}/Dockerfile -t {repo}/coordinator-service:{tag} {service_path}'
    print(f"Running Command: {coordinator_command}")
    coordinator_build = Popen([coordinator_command], shell=True, stdin=PIPE, stdout=PIPE, stderr=PIPE)
    output, error = coordinator_build.communicate()
    if error:
        print(error.decode("utf-8") )
    if output:
        print(output.decode("utf-8") )
    
    push_command = f'docker push {repo}/coordinator-service:{tag}'
    print(f"Running Command: {push_command}")
    coordinator_push = Popen([push_command], shell=True, stdin=PIPE, stdout=PIPE, stderr=PIPE)
    output, error = coordinator_push.communicate()
    if error:
        print(error.decode("utf-8") )
    if output:
        print(output.decode("utf-8") )
        
if __name__ == "__main__":
    cli()