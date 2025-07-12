#!/usr/bin/env node

// Load environment variables from .env file FIRST, before any other imports
try {
  require('dotenv').config();
  console.log('✅ Loaded .env file');
} catch (e) {
  console.log('⚠️  dotenv not installed, continuing without .env file');
}

import * as cdk from 'aws-cdk-lib';
import { AparoidStack } from '../lib/aparoid-stack';
import { DatalakeStack } from '../lib/datalake-stack';
import { FrontendStack } from '../lib/frontend-stack';

const app = new cdk.App();

// Get environment configuration from environment variables
// Prioritize .env file values over AWS profile values
const targetAccount = process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT;
const targetRegion = process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || 'us-east-2';

// Debug: Show what environment variables are being read
console.log('🔍 Environment variables:');
console.log(`  CDK_DEFAULT_ACCOUNT: ${process.env.CDK_DEFAULT_ACCOUNT || 'NOT SET'}`);
console.log(`  AWS_ACCOUNT_ID: ${process.env.AWS_ACCOUNT_ID || 'NOT SET'}`);
console.log(`  CDK_DEFAULT_REGION: ${process.env.CDK_DEFAULT_REGION || 'NOT SET'}`);
console.log(`  AWS_REGION: ${process.env.AWS_REGION || 'NOT SET'}`);
console.log(`  AWS_PROFILE: ${process.env.AWS_PROFILE || 'NOT SET'}`);

console.log(`🎯 Deploying to Account: ${targetAccount}, Region: ${targetRegion}`);

// Validate that we have the required environment variables
if (!targetAccount) {
  throw new Error('AWS_ACCOUNT_ID or CDK_DEFAULT_ACCOUNT environment variable is required');
}

new AparoidStack(app, 'AparoidStack', {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  env: { account: targetAccount, region: targetRegion },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});

new DatalakeStack(app, 'DatalakeStack', {
  env: { account: targetAccount, region: targetRegion },
});

new FrontendStack(app, 'FrontendStack', {
  env: { account: targetAccount, region: targetRegion },
});