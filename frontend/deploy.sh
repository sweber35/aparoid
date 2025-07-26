#!/bin/bash

# Frontend deployment script for Aparoid
# This script builds the Vite/SolidJS app and deploys it to S3 with CloudFront invalidation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Aparoid Frontend Deployment${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "vite.config.ts" ]; then
    echo -e "${RED}❌ Error: This script must be run from the frontend directory with a Vite project${NC}"
    exit 1
fi

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ Error: AWS CLI is not installed${NC}"
    exit 1
fi

# Get stack outputs
echo -e "${YELLOW}📋 Getting stack outputs...${NC}"

# Get the website bucket name
WEBSITE_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name FrontendStack \
    --query 'Stacks[0].Outputs[?OutputKey==`WebsiteBucketName`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -z "$WEBSITE_BUCKET" ]; then
    echo -e "${RED}❌ Error: Could not get website bucket name from CloudFormation stack${NC}"
    echo -e "${YELLOW}💡 Make sure the FrontendStack is deployed first${NC}"
    exit 1
fi

# Get the CloudFront distribution ID
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name FrontendStack \
    --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -z "$DISTRIBUTION_ID" ]; then
    echo -e "${RED}❌ Error: Could not get CloudFront distribution ID from CloudFormation stack${NC}"
    exit 1
fi

# Get API URLs from FrontendStack outputs (which import from ProcessingStack)
REPLAY_STUB_URL=$(aws cloudformation describe-stacks \
    --stack-name FrontendStack \
    --query 'Stacks[0].Outputs[?OutputKey==`ReplayStubApiUrl`].OutputValue' \
    --output text 2>/dev/null || echo "")

REPLAY_DATA_URL=$(aws cloudformation describe-stacks \
    --stack-name FrontendStack \
    --query 'Stacks[0].Outputs[?OutputKey==`ReplayDataApiUrl`].OutputValue' \
    --output text 2>/dev/null || echo "")

REPLAY_TAG_URL=$(aws cloudformation describe-stacks \
    --stack-name FrontendStack \
    --query 'Stacks[0].Outputs[?OutputKey==`ReplayTagApiUrl`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -z "$REPLAY_STUB_URL" ] || [ -z "$REPLAY_DATA_URL" ] || [ -z "$REPLAY_TAG_URL" ]; then
    echo -e "${RED}❌ Error: Could not get API URLs from FrontendStack outputs${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found website bucket: ${WEBSITE_BUCKET}${NC}"
echo -e "${GREEN}✅ Found CloudFront distribution: ${DISTRIBUTION_ID}${NC}"
echo -e "${GREEN}✅ Found API URLs:${NC}"
echo -e "${BLUE}   Replay Stub: ${REPLAY_STUB_URL}${NC}"
echo -e "${BLUE}   Replay Data: ${REPLAY_DATA_URL}${NC}"
echo -e "${BLUE}   Replay Tag: ${REPLAY_TAG_URL}${NC}"

# Generate frontend config with API URLs
echo -e "${YELLOW}🔧 Generating frontend config...${NC}"

# Create the config file content
CONFIG_CONTENT="// Auto-generated config file with API URLs from ProcessingStack
// This file is updated automatically during deployment

// API Configuration
export const API_CONFIG = {
  replayStub: '${REPLAY_STUB_URL}',
  replayData: '${REPLAY_DATA_URL}',
  replayTag: '${REPLAY_TAG_URL}',
  timeout: 30000,
};

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
"

# Write the config file
echo "$CONFIG_CONTENT" > src/config.ts

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to generate config file${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Config file generated${NC}"

# Build the project
echo -e "${YELLOW}🔨 Building the project...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build completed${NC}"

# Check if dist directory exists
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Error: dist directory not found after build${NC}"
    exit 1
fi

# Upload to S3
echo -e "${YELLOW}📤 Uploading to S3...${NC}"
aws s3 sync dist/ s3://$WEBSITE_BUCKET/ --delete

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Upload failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Upload completed${NC}"

# Invalidate CloudFront cache
echo -e "${YELLOW}🔄 Invalidating CloudFront cache...${NC}"
aws cloudfront create-invalidation \
    --distribution-id $DISTRIBUTION_ID \
    --paths "/*"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Cache invalidation failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Cache invalidation completed${NC}"

# Get the CloudFront URL
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name FrontendStack \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
    --output text 2>/dev/null || echo "")

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${BLUE}🌐 Your frontend is available at: ${CLOUDFRONT_URL}${NC}"
echo -e "${YELLOW}💡 Note: It may take a few minutes for CloudFront to propagate the changes${NC}"