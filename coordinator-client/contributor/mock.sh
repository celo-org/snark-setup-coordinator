#!/bin/bash

echo "args: $@"
SLEEP_TIME=$(shuf -i 1-10 -n 1)
OUTPUT_PATH="${@: -1}"

echo "sleep: $SLEEP_TIME"
sleep $SLEEP_TIME

echo "$@" > $OUTPUT_PATH
echo "output: $OUTPUT_PATH"
