#!/bin/bash

set -e

echo "🔨 Building slippc binary for Lambda layer..."

# Build binary using Docker
echo "📦 Building with Docker..."
docker build -t slippc-builder ./slp-parser

# Copy binary out of container
echo "📋 Extracting binary..."
CONTAINER_ID=$(docker create slippc-builder)
docker cp "$CONTAINER_ID":/src/slippc/slippc ./lambda-layers/slippc-layer/bin/slippc
docker rm "$CONTAINER_ID"

# Make binary executable
echo "🔧 Making binary executable..."
chmod +x lambda-layers/slippc-layer/bin/slippc

# Verify binary
echo "✅ Verifying binary..."
echo "Binary size:"
ls -lh lambda-layers/slippc-layer/bin/slippc
echo "Binary architecture:"
file lambda-layers/slippc-layer/bin/slippc

echo "🎉 Slippc binary built successfully!"
echo "📁 Binary location: lambda-layers/slippc-layer/bin/slippc"
echo "💡 To deploy: npm run deploy:processing" 