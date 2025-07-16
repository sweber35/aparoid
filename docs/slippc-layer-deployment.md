# Slippc Lambda Layer Deployment

This document explains how the `slippc` binary is built and deployed to the Lambda layer.

## Overview

The `slippc` binary is a C++ application that parses SLP (Super Smash Bros. Melee replay) files. It's built using Docker and deployed as a Lambda layer so it can be used by Lambda functions.

## Architecture

```
slp-parser/                    # C++ source code
├── Dockerfile                 # Builds the binary
├── makefile                   # Compilation rules
└── src/                       # Source files

lambda-layers/slippc-layer/    # Lambda layer structure
└── bin/
    └── slippc                 # Built binary (committed to Git)

.github/workflows/
└── build-slippc-layer.yml     # GitHub Actions workflow
```

## Local Development

### Building the Binary

```bash
# Build the slippc binary locally
npm run build:slippc

# This will:
# 1. Build the binary using Docker
# 2. Extract it to lambda-layers/slippc-layer/bin/slippc
# 3. Make it executable
# 4. Verify the binary
```

### Deploying the Layer

```bash
# Deploy the ProcessingStack (includes the Lambda layer)
npm run deploy:processing

# This will:
# 1. Package the lambda-layers/slippc-layer directory
# 2. Create/update the Lambda layer
# 3. Update any Lambda functions that use this layer
```

## GitHub Actions Workflow

The workflow `.github/workflows/build-slippc-layer.yml` automatically:

1. **Triggers** on:
   - Push to `main` branch with changes to `slp-parser/` or `lambda-layers/slippc-layer/`
   - Manual workflow dispatch

2. **Builds** the binary using Docker Buildx
3. **Extracts** the binary to the Lambda layer directory
4. **Deploys** the updated layer via CDK
5. **Commits** the binary back to the repository

## Usage in Lambda Functions

The `slippc` binary is available at `/opt/bin/slippc` in Lambda functions that use this layer.

### Example Usage

```javascript
const { execFile } = require('child_process');

async function parseSlpFile(inputPath, outputPath) {
  const slippcPath = '/opt/bin/slippc';
  
  return new Promise((resolve, reject) => {
    execFile(
      slippcPath,
      [
        '-i', inputPath,        // Input SLP file
        '-j', outputPath,       // Output JSON directory
        '-a', outputPath + '/analysis.json',  // Analysis file
        '-f',                   // Force overwrite
      ],
      (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(`slippc failed: ${error.message}`));
        }
        resolve({ stdout, stderr });
      }
    );
  });
}
```

## Current Integration

The slippc layer is currently used by:
- `aparoid-slp-to-parquet` Lambda function (in ProcessingStack)

## Troubleshooting

### Binary Not Found
- Ensure the Lambda function has the slippc layer attached
- Check that the binary path is `/opt/bin/slippc`
- Verify the layer was deployed successfully

### Build Failures
- Check that the Docker base image `ghcr.io/sweber35/slippc-arrow-base:latest` exists
- Verify the C++ dependencies are available in the base image
- Check the build logs for compilation errors

### Deployment Issues
- Ensure AWS credentials are configured
- Check that the ProcessingStack can be deployed
- Verify the binary is committed to the repository

## Security Notes

- The binary is built from source code in the `slp-parser/` directory
- The Docker build process ensures consistent builds across environments
- The binary is committed to Git for reproducible deployments 