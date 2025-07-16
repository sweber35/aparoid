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
* `npx cdk synth`   emits the synthesized CloudFormation template

### Deployment Commands

* `npx cdk deploy --all`  deploy all stacks to your default AWS account/region
* `npx cdk deploy StorageStack`  deploy only the storage stack
* `npx cdk deploy GlueStack`  deploy only the Glue stack (requires StorageStack)
* `npx cdk deploy ProcessingStack`  deploy only the processing stack (requires StorageStack)
* `npx cdk diff`  compare deployed stack with current state
* `npx cdk destroy --all`  destroy all stacks (use with caution!)
* `npm run cleanup-logs`  clean up CloudWatch log groups if they cause conflicts
* `npm run update-views`  update Glue views without redeploying the entire stack (useful for view development)

## Stacks

### Core Stacks
- **AparoidStack**: Main application stack

### Data Lake Stacks (Sub-stacks)
- **StorageStack**: S3 buckets for raw SLP files and processed data, DynamoDB tables, plus lookup data deployment
- **GlueStack**: AWS Glue database, tables, and views for data analytics
- **ProcessingStack**: Lambda functions and processing logic for SLP file conversion
- **TestFilesStack**: Deploys test SLP files to the existing replays bucket
- **FrontendStack**: S3 static hosting with CloudFront CDN for the Vite/SolidJS frontend

### Resource Naming Convention
All resources follow a consistent naming pattern: `aparoid-{resource-type}-{region}` or `aparoid-{resource-type}-{account}-{region}`

Examples:
- S3 Buckets: `aparoid-slp-replays-{account}-{region}`, `aparoid-processed-data-{account}-{region}`
- Lambda Functions: `aparoid-slp-to-parquet-{region}`, `aparoid-create-glue-views-{region}`
- DynamoDB Tables: `aparoid-replay-tags-{region}`
- Glue Database: `aparoid-replay-data-{region}`

### Deployment Order
The stacks are deployed in the following order to ensure proper dependencies:
1. StorageStack (creates S3 buckets and DynamoDB tables)
2. GlueStack (depends on StorageStack for bucket names)
3. ProcessingStack (depends on StorageStack for bucket names)
4. FrontendStack (depends on ProcessingStack for API Gateway URLs)
5. TestFilesStack (deploys test SLP files AFTER processing infrastructure is ready)

### Efficient View Development
To avoid full stack redeployment when developing Glue views:

1. **For view updates only**: Use `npm run update-views` to update views without redeploying the entire GlueStack
2. **For view development**: Edit the views in `lambda/create-glue-views/index.js`, then run `npm run update-views`
3. **For new views**: Add them to the `views` array in the Lambda function, then run `npm run update-views`

This approach significantly speeds up the development cycle for view modifications.

## Frontend Integration

The project includes infrastructure for hosting a Vite/SolidJS frontend:

### Setup
1. **Copy your existing Vite/SolidJS project** to the `frontend/` directory
2. **Deploy the infrastructure**: `npm run deploy`
3. **Get API URLs**: `node util/get-api-urls.js`
4. **Deploy your frontend**: `cd frontend && ./deploy.sh`

### Features
- **S3 Static Hosting**: Secure bucket with CloudFront CDN
- **HTTPS**: Automatic SSL certificate and HTTPS redirect
- **SPA Support**: Proper routing for single-page applications
- **API Integration**: Pre-configured CORS for Lambda APIs
- **Fast Deployments**: Automated build and deployment script

See `frontend/README.md` for detailed setup instructions.
