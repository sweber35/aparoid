import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export interface StorageStackProps extends cdk.StackProps {
  // No longer need deployTestFiles prop since test files are handled separately
}

export class StorageStack extends cdk.Stack {
  public readonly slpReplayBucket: s3.Bucket;
  public readonly processedSlpDataBucket: s3.Bucket;
  public readonly replayCacheBucket: s3.Bucket;
  public readonly replayTagsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: StorageStackProps) {
    super(scope, id, props);

    // S3 bucket for raw SLP replay files
    this.slpReplayBucket = new s3.Bucket(this, 'aparoid-slp-replays-bucket', {
      bucketName: `${this.account}-${this.region}-aparoid-slp-replays`,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT for production!
      autoDeleteObjects: true,
    });

    // S3 bucket for processed SLP data
    this.processedSlpDataBucket = new s3.Bucket(this, 'aparoid-processed-data-bucket', {
      bucketName: `${this.account}-${this.region}-aparoid-processed-data`,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // S3 bucket for replay data cache
    this.replayCacheBucket = new s3.Bucket(this, 'aparoid-replay-cache-bucket', {
      bucketName: `${this.account}-${this.region}-aparoid-replay-cache`,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(7), // Cache expires after 7 days
        },
      ],
    });

    // Auto-populate processed data bucket with lookup data
    new s3deploy.BucketDeployment(this, 'aparoid-lookup-data-deployment', {
      sources: [s3deploy.Source.asset('lookup-data')],
      destinationBucket: this.processedSlpDataBucket,
      destinationKeyPrefix: 'lookup',
    });

    // DynamoDB table for replay tags
    this.replayTagsTable = new dynamodb.Table(this, 'aparoid-replay-tags-table', {
      tableName: `${this.account}-${this.region}-replay-tags`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT for production!
    });

    // Output the bucket names for cross-stack references
    new cdk.CfnOutput(this, 'SlpReplayBucketName', {
      value: this.slpReplayBucket.bucketName,
      description: 'Name of the S3 bucket for raw SLP replay files',
      exportName: `${this.stackName}-SlpReplayBucketName`,
    });

    new cdk.CfnOutput(this, 'ProcessedSlpDataBucketName', {
      value: this.processedSlpDataBucket.bucketName,
      description: 'Name of the S3 bucket for processed SLP data',
      exportName: `${this.stackName}-ProcessedSlpDataBucketName`,
    });

    new cdk.CfnOutput(this, 'ReplayCacheBucketName', {
      value: this.replayCacheBucket.bucketName,
      description: 'Name of the S3 bucket for replay data cache',
      exportName: `${this.stackName}-ReplayCacheBucketName`,
    });

    // Output the table name for cross-stack references
    new cdk.CfnOutput(this, 'ReplayTagsTableName', {
      value: this.replayTagsTable.tableName,
      description: 'Name of the DynamoDB table for replay tags',
      exportName: `${this.stackName}-ReplayTagsTableName`,
    });
  }
} 