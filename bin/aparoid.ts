#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StorageStack } from '../lib/storage-stack';
import { GlueStack } from '../lib/glue-stack';
import { ProcessingStack } from '../lib/processing-stack';
import { TestFilesStack } from '../lib/test-files-stack';
import { AuthStack } from '../lib/auth-stack';

const app = new cdk.App();

const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION };

// Create the auth stack first
const authStack = new AuthStack(app, 'AuthStack', {
  env,
});

// Create the storage stack
const storageStack = new StorageStack(app, 'StorageStack', {
  env,
});

// Create the glue stack
const glueStack = new GlueStack(app, 'GlueStack', {
  env,
  processedDataBucketName: storageStack.processedSlpDataBucket.bucketName,
});

// Create the processing stack with auth integration
const processingStack = new ProcessingStack(app, 'ProcessingStack', {
  env,
  slpReplayBucketName: storageStack.slpReplayBucket.bucketName,
  processedDataBucketName: storageStack.processedSlpDataBucket.bucketName,
  replayCacheBucketName: storageStack.replayCacheBucket.bucketName,
  tagTableName: storageStack.replayTagsTable.tableName,
  matchDeduplicationTableName: storageStack.matchDeduplicationTable.tableName, // Add deduplication table
  glueDatabaseName: glueStack.glueDb.ref,
  athenaOutputLocation: `s3://${storageStack.processedSlpDataBucket.bucketName}/athena-query-results/`,
  userAccessRoleArn: storageStack.userAccessRole.roleArn, // Pass user access role for multi-tenancy
  userPool: authStack.userPool, // Pass user pool for JWT authorization
});

// Create the test files stack
const testFilesStack = new TestFilesStack(app, 'TestFilesStack', {
  env,
  slpReplayBucketName: storageStack.slpReplayBucket.bucketName,
});

// Add dependencies
glueStack.addDependency(storageStack);
processingStack.addDependency(storageStack);
processingStack.addDependency(glueStack);
processingStack.addDependency(authStack);
testFilesStack.addDependency(storageStack);

app.synth();