#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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
    console.error(`Failed to get ${outputKey} from ${stackName}:`, error.message);
    return null;
  }
}

function generateConfigFile() {
  log('🔧 Generating frontend config with API URLs...', 'blue');
  
  // Get API URLs from ProcessingStack
  const replayStubUrl = getStackOutput('ProcessingStack', 'ReplayStubApiUrl');
  const replayDataUrl = getStackOutput('ProcessingStack', 'ReplayDataApiUrl');
  const replayTagUrl = getStackOutput('ProcessingStack', 'ReplayTagApiUrl');
  
  if (!replayStubUrl || !replayDataUrl || !replayTagUrl) {
    log('❌ Failed to get API URLs from ProcessingStack', 'red');
    log('💡 Make sure ProcessingStack is deployed first', 'yellow');
    process.exit(1);
  }
  
  log('✅ Retrieved API URLs:', 'green');
  log(`   Replay Stub: ${replayStubUrl}`, 'blue');
  log(`   Replay Data: ${replayDataUrl}`, 'blue');
  log(`   Replay Tag: ${replayTagUrl}`, 'blue');
  
  // Generate the config file content
  const configContent = `// Auto-generated config file with API URLs from ProcessingStack
// This file is updated automatically during deployment

// API Configuration
export const API_CONFIG = {
  replayStub: '${replayStubUrl}',
  replayData: '${replayDataUrl}',
  replayTag: '${replayTagUrl}',
  timeout: 30000,
} as const;

// API client for making requests to the Lambda functions
export class ApiClient {
  private timeout: number;

  constructor(timeout = API_CONFIG.timeout) {
    this.timeout = timeout;
  }

  async request(url: string, options: RequestInit = {}): Promise<any> {
    const config: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (options.body) {
      config.body = options.body;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(\`HTTP error! status: \${response.status}\`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Replay Stub API - Process SLP replay files
  async processReplay(replayData: any) {
    return this.request(API_CONFIG.replayStub, {
      body: JSON.stringify({
        action: 'process_replay',
        data: replayData,
      }),
    });
  }

  // Replay Data API - Query replay data
  async queryReplayData(query: string) {
    return this.request(API_CONFIG.replayData, {
      body: JSON.stringify({
        action: 'query_data',
        query: query,
      }),
    });
  }

  // Replay Tag API - Get tags for a replay
  async getTags(replayId: string) {
    return this.request(API_CONFIG.replayTag, {
      body: JSON.stringify({
        action: 'get_tags',
        replayId: replayId,
      }),
    });
  }

  // Replay Tag API - Add a tag to a replay
  async addTag(replayId: string, tag: { name: string; value?: string }) {
    return this.request(API_CONFIG.replayTag, {
      body: JSON.stringify({
        action: 'add_tag',
        replayId: replayId,
        tag: tag,
      }),
    });
  }

  // Replay Tag API - Remove a tag from a replay
  async removeTag(replayId: string, tagId: string) {
    return this.request(API_CONFIG.replayTag, {
      body: JSON.stringify({
        action: 'remove_tag',
        replayId: replayId,
        tagId: tagId,
      }),
    });
  }
}

// Create a singleton instance
export const apiClient = new ApiClient();
`;

  // Write the config file
  const configPath = path.join(__dirname, '..', 'frontend', 'src', 'config.ts');
  
  try {
    fs.writeFileSync(configPath, configContent, 'utf8');
    log(`✅ Generated config file: ${configPath}`, 'green');
  } catch (error) {
    log(`❌ Failed to write config file: ${error.message}`, 'red');
    process.exit(1);
  }
  
  log('🎉 Frontend config generation completed!', 'green');
  log('💡 The frontend will now use the correct API URLs from ProcessingStack', 'blue');
}

if (require.main === module) {
  generateConfigFile();
}

module.exports = { generateConfigFile }; 