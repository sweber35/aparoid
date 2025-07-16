#!/bin/bash
docker build -t slippc-lambda .
docker create --name slippc-temp slippc-lambda
docker cp slippc-temp:/output/slippc ./output/slippc
docker rm slippc-temp
echo "Binary copied to ./output/slippc"