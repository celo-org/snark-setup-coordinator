#!/bin/bash

SLEEP_TIME=$(shuf -i 1-10 -n 1)
CHUNK_ID=$1
OUTPUT_PATH=$2
echo "Output stuff for '$CHUNK_ID'"
echo "stuff-$CHUNK_ID" > $OUTPUT_PATH
echo "Sleeping $SLEEP_TIME"
sleep $SLEEP_TIME
