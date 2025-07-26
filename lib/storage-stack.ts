import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface StorageStackProps extends cdk.StackProps {
  // No longer need deployTestFiles prop since test files are handled separately
}

export class StorageStack extends cdk.Stack {
  public readonly slpReplayBucket: s3.Bucket;
  public readonly processedSlpDataBucket: s3.Bucket;
  public readonly replayCacheBucket: s3.Bucket;
  public readonly replayTagsTable: dynamodb.Table;
  public readonly userAccessRole: iam.Role;
  public readonly matchDeduplicationTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: StorageStackProps) {
    super(scope, id, props);

    // S3 bucket for raw SLP replay files
    this.slpReplayBucket = new s3.Bucket(this, 'aparoid-slp-replays-bucket', {
      bucketName: `${this.account}-${this.region}-aparoid-slp-replays`,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT for production!
      autoDeleteObjects: true,
      // Add bucket policy for multi-tenant access control
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // S3 bucket for processed SLP data
    this.processedSlpDataBucket = new s3.Bucket(this, 'aparoid-processed-data-bucket', {
      bucketName: `${this.account}-${this.region}-aparoid-processed-data`,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      // Add bucket policy for multi-tenant access control
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
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
      // Add bucket policy for multi-tenant access control
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // Auto-populate processed data bucket with lookup data
    new s3deploy.BucketDeployment(this, 'aparoid-lookup-data-deployment', {
      sources: [s3deploy.Source.asset('lookup-data')],
      destinationBucket: this.processedSlpDataBucket,
      destinationKeyPrefix: 'lookup',
    });

    // Create DynamoDB table for replay tags
    this.replayTagsTable = new dynamodb.Table(this, 'aparoid-replay-tags-table', {
      tableName: `${this.account}-${this.region}-replay-tags`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT for production
    });

    // Add GSI for processing status lookups
    this.matchDeduplicationTable.addGlobalSecondaryIndex({
      indexName: 'processing-status-index',
      partitionKey: { name: 'processing_status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Add GSI for user access tracking
    this.matchDeduplicationTable.addGlobalSecondaryIndex({
      indexName: 'user-access-index',
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'match_id', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Create IAM role for user access to their data
    this.userAccessRole = new iam.Role(this, 'aparoid-user-access-role', {
      roleName: 'aparoid-user-access-role',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for users to access their own data in Aparoid',
    });

    // Add bucket policies for multi-tenant access control
    this.addMultiTenantBucketPolicies();

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

    // Output the table name for other stacks to use
    new cdk.CfnOutput(this, 'ReplayTagsTableName', {
      value: this.replayTagsTable.tableName,
      description: 'Name of the replay tags DynamoDB table',
      exportName: `${this.stackName}-ReplayTagsTableName`,
    });

    new cdk.CfnOutput(this, 'MatchDeduplicationTableName', {
      value: this.matchDeduplicationTable.tableName,
      description: 'Name of the match deduplication DynamoDB table',
      exportName: `${this.stackName}-MatchDeduplicationTableName`,
    });

    // Output the user access role ARN
    new cdk.CfnOutput(this, 'UserAccessRoleArn', {
      value: this.userAccessRole.roleArn,
      description: 'ARN of the IAM role for user data access',
      exportName: `${this.stackName}-UserAccessRoleArn`,
    });
  }

  private addMultiTenantBucketPolicies() {
    // Policy for SLP replay bucket - users can only access their own user_id folder
    this.slpReplayBucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [this.userAccessRole],
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
        's3:ListBucket',
      ],
      resources: [
        this.slpReplayBucket.bucketArn,
        `${this.slpReplayBucket.bucketArn}/*`,
      ],
      conditions: {
        'StringEquals': {
          'aws:PrincipalTag/user_id': '${aws:PrincipalTag/user_id}',
        },
        'StringLike': {
          's3:prefix': '${aws:PrincipalTag/user_id}/*',
        },
      },
    }));

    // Policy for processed data bucket - users can only access their own user_id partitions
    this.processedSlpDataBucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [this.userAccessRole],
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
        's3:ListBucket',
      ],
      resources: [
        this.processedSlpDataBucket.bucketArn,
        `${this.processedSlpDataBucket.bucketArn}/*`,
      ],
      conditions: {
        'StringEquals': {
          'aws:PrincipalTag/user_id': '${aws:PrincipalTag/user_id}',
        },
        'StringLike': {
          's3:prefix': [
            'frames/user_id=${aws:PrincipalTag/user_id}/*',
            'items/user_id=${aws:PrincipalTag/user_id}/*',
            'attacks/user_id=${aws:PrincipalTag/user_id}/*',
            'punishes/user_id=${aws:PrincipalTag/user_id}/*',
            'match-settings/user_id=${aws:PrincipalTag/user_id}/*',
            'player-settings/user_id=${aws:PrincipalTag/user_id}/*',
            'platforms/user_id=${aws:PrincipalTag/user_id}/*',
          ],
        },
      },
    }));

    // Policy for cache bucket - users can only access their own cache entries
    this.replayCacheBucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [this.userAccessRole],
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
        's3:ListBucket',
      ],
      resources: [
        this.replayCacheBucket.bucketArn,
        `${this.replayCacheBucket.bucketArn}/*`,
      ],
      conditions: {
        'StringEquals': {
          'aws:PrincipalTag/user_id': '${aws:PrincipalTag/user_id}',
        },
        'StringLike': {
          's3:prefix': [
            'stubs/*/${aws:PrincipalTag/user_id}/*',
            'replays/${aws:PrincipalTag/user_id}/*',
          ],
        },
      },
    }));
  }
} 