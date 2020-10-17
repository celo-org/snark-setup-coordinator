#!/bin/sh

set -e

docker build -t snark-setup-binaries .
docker run --name snark-setup-binaries-container snark-setup-binaries /bin/true
docker cp snark-setup-binaries-container:/app/powersoftau .
docker rm snark-setup-binaries-container
