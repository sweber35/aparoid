# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Environment Configuration

Before deploying, configure your AWS environment:

1. **Copy the example environment file:**
   ```bash
   cp env.example .env
   ```

2. **Edit `.env` with your AWS account details:**
   ```bash
   AWS_ACCOUNT_ID=your_aws_account_id
   AWS_REGION=your_preferred_region
   CDK_DEFAULT_ACCOUNT=your_aws_account_id
   CDK_DEFAULT_REGION=your_preferred_region
   ```

3. **Verify your AWS credentials:**
   ```bash
   aws sts get-caller-identity
   ```

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## Stacks

- **DatalakeStack**: S3 buckets, Lambda function with slippc layer, and S3 event notifications
- **FrontendStack**: Lambda functions and DynamoDB table for frontend services
