#!/usr/bin/env node

// Load environment variables from .env file FIRST, before any other imports
try {
  require('dotenv').config();
  console.log('✅ Loaded .env file');
} catch (e) {
  console.log('⚠️  dotenv not installed, continuing without .env file');
}

import * as cdk from 'aws-cdk-lib';
import { StorageStack } from '../lib/storage-stack';
import { GlueStack } from '../lib/glue-stack';
import { ProcessingStack } from '../lib/processing-stack';
import { TestFilesStack } from '../lib/test-files-stack';
import { FrontendStack } from '../lib/frontend-stack';

const app = new cdk.App();

// Get environment configuration from environment variables
// Prioritize .env file values over AWS profile values
const targetAccount = process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT;
const targetRegion = process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || 'us-east-1';

// Debug: Show what environment variables are being read
console.log('🔍 Environment variables:');
console.log(`  CDK_DEFAULT_ACCOUNT: ${process.env.CDK_DEFAULT_ACCOUNT || 'NOT SET'}`);
console.log(`  AWS_ACCOUNT_ID: ${process.env.AWS_ACCOUNT_ID || 'NOT SET'}`);
console.log(`  CDK_DEFAULT_REGION: ${process.env.CDK_DEFAULT_REGION || 'NOT SET'}`);
console.log(`  AWS_REGION: ${process.env.AWS_REGION || 'NOT SET'}`);
console.log(`  AWS_PROFILE: ${process.env.AWS_PROFILE || 'NOT SET'}`);

// Validate that we have the required environment variables
if (!targetAccount) {
  throw new Error('AWS_ACCOUNT_ID or CDK_DEFAULT_ACCOUNT environment variable is required');
}

const env = { account: targetAccount, region: targetRegion };

// Create the datalake stacks
const storageStack = new StorageStack(app, 'StorageStack', { env });

const glueStack = new GlueStack(app, 'GlueStack', {
  env,
  processedDataBucketName: storageStack.processedSlpDataBucket.bucketName,
});

const processingStack = new ProcessingStack(app, 'ProcessingStack', {
  env,
  slpReplayBucketName: storageStack.slpReplayBucket.bucketName,
  processedDataBucketName: storageStack.processedSlpDataBucket.bucketName,
  replayCacheBucketName: storageStack.replayCacheBucket.bucketName,
  tagTableName: storageStack.replayTagsTable.tableName,
  glueDatabaseName: glueStack.glueDb.ref,
  athenaOutputLocation: `s3://${storageStack.processedSlpDataBucket.bucketName}/athena-query-results/`,
});

// Create test files stack that depends on processing stack
const testFilesStack = new TestFilesStack(app, 'TestFilesStack', {
  env,
  slpReplayBucketName: storageStack.slpReplayBucket.bucketName,
});

// Create frontend stack
const frontendStack = new FrontendStack(app, 'FrontendStack', {
  env,
  processingStack: processingStack,
});

// Add dependencies to ensure proper deployment order
glueStack.addDependency(storageStack);
processingStack.addDependency(storageStack);
processingStack.addDependency(glueStack);
testFilesStack.addDependency(processingStack);
frontendStack.addDependency(processingStack);