# Slippc Lambda Layer

This Lambda layer contains the `slippc` binary for parsing SLP (Super Smash Bros. Melee replay) files.

## Structure

```
slippc-layer/
└── bin/
    └── slippc          # The slippc binary executable
```

## Usage

In your Lambda function, the `slippc` binary will be available at `/opt/bin/slippc` when this layer is attached.

## Example

```javascript
const { execFile } = require('child_process');

function parseWithSlippc(fileName, outputPath) {
  const slippcPath = '/opt/bin/slippc';  // Path in Lambda runtime

  return new Promise((resolve, reject) => {
    execFile(
      slippcPath,
      [
        '-i', fileName,
        '-j', outputPath,
        '-a', outputPath + '/analysis.json',
        '-f',
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

## Deployment

This layer is deployed via CDK and automatically attached to the SLP processing Lambda function. 