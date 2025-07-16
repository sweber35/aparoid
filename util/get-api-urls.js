#!/usr/bin/env node

const { execSync } = require('child_process');

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function getStackOutput(stackName, outputKey) {
  try {
    const result = execSync(
      `aws cloudformation describe-stacks --stack-name ${stackName} --query "Stacks[0].Outputs[?OutputKey=='${outputKey}'].OutputValue" --output text`,
      { encoding: 'utf8' }
    ).trim();
    return result;
  } catch (error) {
    return null;
  }
}

function main() {
  log('🔍 Fetching API Gateway URLs...', 'blue');
  
  // Get ProcessingStack outputs
  const replayStubApiUrl = getStackOutput('ProcessingStack', 'ReplayStubApiUrl');
  const replayDataApiUrl = getStackOutput('ProcessingStack', 'ReplayDataApiUrl');
  const replayTagApiUrl = getStackOutput('ProcessingStack', 'ReplayTagApiUrl');
  
  // Get FrontendStack outputs
  const cloudFrontUrl = getStackOutput('FrontendStack', 'CloudFrontUrl');
  
  log('\n📋 API Endpoints:', 'yellow');
  log('================', 'yellow');
  
  if (replayStubApiUrl) {
    log(`\n🔄 Replay Stub API:`, 'green');
    log(`   ${replayStubApiUrl}`, 'blue');
    log(`   Method: POST`, 'reset');
    log(`   Purpose: Process SLP replay files`, 'reset');
  } else {
    log(`\n❌ Replay Stub API: Not deployed`, 'red');
  }
  
  if (replayDataApiUrl) {
    log(`\n📊 Replay Data API:`, 'green');
    log(`   ${replayDataApiUrl}`, 'blue');
    log(`   Method: POST`, 'reset');
    log(`   Purpose: Query replay data`, 'reset');
  } else {
    log(`\n❌ Replay Data API: Not deployed`, 'red');
  }
  
  if (replayTagApiUrl) {
    log(`\n🏷️  Replay Tag API:`, 'green');
    log(`   ${replayTagApiUrl}`, 'blue');
    log(`   Method: POST`, 'reset');
    log(`   Purpose: Manage replay tags`, 'reset');
  } else {
    log(`\n❌ Replay Tag API: Not deployed`, 'red');
  }
  
  if (cloudFrontUrl) {
    log(`\n🌐 Frontend URL:`, 'green');
    log(`   ${cloudFrontUrl}`, 'blue');
    log(`   Purpose: Your deployed frontend`, 'reset');
  } else {
    log(`\n❌ Frontend URL: Not deployed`, 'red');
  }
  
  log('\n💡 Frontend Configuration Example:', 'yellow');
  log('================================', 'yellow');
  log(`
// In your frontend environment configuration:
const API_CONFIG = {
  replayStub: '${replayStubApiUrl || 'YOUR_REPLAY_STUB_API_URL'}',
  replayData: '${replayDataApiUrl || 'YOUR_REPLAY_DATA_API_URL'}',
  replayTag: '${replayTagApiUrl || 'YOUR_REPLAY_TAG_API_URL'}',
  frontendUrl: '${cloudFrontUrl || 'YOUR_FRONTEND_URL'}'
};

// Example usage:
const response = await fetch(API_CONFIG.replayStub, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ /* your data */ })
});
`, 'reset');
  
  log('\n🚀 Next Steps:', 'yellow');
  log('=============', 'yellow');
  log('1. Copy your Vite/SolidJS project to the frontend/ directory', 'reset');
  log('2. Update your API endpoints using the URLs above', 'reset');
  log('3. Run ./frontend/deploy.sh to deploy your frontend', 'reset');
}

if (require.main === module) {
  main();
}

module.exports = { getStackOutput }; 