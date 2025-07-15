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
if [ ! -f "package.json" ] || [ ! -f "vite.config.js" ]; then
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

echo -e "${GREEN}✅ Found website bucket: ${WEBSITE_BUCKET}${NC}"
echo -e "${GREEN}✅ Found CloudFront distribution: ${DISTRIBUTION_ID}${NC}"

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