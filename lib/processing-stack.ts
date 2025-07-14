import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';

export interface ProcessingStackProps extends cdk.StackProps {
  slpReplayBucketName: string;
  processedDataBucketName: string;
}

export class ProcessingStack extends cdk.Stack {
  public readonly slpToParquetLambda: lambda.Function;
  public readonly s3EventNotification: s3n.LambdaDestination;

  constructor(scope: Construct, id: string, props: ProcessingStackProps) {
    super(scope, id, props);

    // Import the S3 buckets from the StorageStack
    const slpReplayBucket = s3.Bucket.fromBucketName(
      this,
      'aparoid-slp-replays-bucket',
      props.slpReplayBucketName
    );

    const processedSlpDataBucket = s3.Bucket.fromBucketName(
      this,
      'aparoid-processed-data-bucket',
      props.processedDataBucketName
    );

    // Slippc Lambda layer
    const slippcLayer = new lambda.LayerVersion(this, 'aparoid-slippc-layer', {
      layerVersionName: `aparoid-slippc-layer`,
      code: lambda.Code.fromAsset('lambda-layers/slippc-layer'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'Layer containing slippc binary for SLP file parsing',
    });

    // Create explicit CloudWatch log group for the Lambda function
    const lambdaLogGroup = new logs.LogGroup(this, 'aparoid-slp-to-parquet-logs', {
      logGroupName: `/aws/lambda/aparoid-slp-to-parquet`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_WEEK,
    });

    // SLP to Parquet Lambda function
    this.slpToParquetLambda = new lambda.Function(this, 'aparoid-slp-to-parquet-lambda', {
      functionName: `aparoid-slp-to-parquet`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/slp-to-parquet'),
      layers: [slippcLayer],
      environment: {
        SLIPPI_CODE: process.env.SLIPPI_CODE || '',
        SLIPPI_USER_ID: process.env.SLIPPI_USER_ID || '',
        DEPLOYMENT_REGION: this.region,
        PROCESSED_DATA_BUCKET: props.processedDataBucketName,
      },
      timeout: cdk.Duration.minutes(1),
      memorySize: 256,
      logGroup: lambdaLogGroup, // Use the explicit log group
    });

    // Grant permissions to the Lambda function
    slpReplayBucket.grantRead(this.slpToParquetLambda);
    processedSlpDataBucket.grantWrite(this.slpToParquetLambda);

    // Create S3 event notification
    this.s3EventNotification = new s3n.LambdaDestination(this.slpToParquetLambda);

    // Add S3 event notification to trigger Lambda when new SLP files are uploaded
    slpReplayBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      this.s3EventNotification
    );

    // Output the Lambda function name for cross-stack references
    new cdk.CfnOutput(this, 'SlpToParquetLambdaName', {
      value: this.slpToParquetLambda.functionName,
      description: 'Name of the Lambda function for SLP to Parquet conversion',
      exportName: `${this.stackName}-SlpToParquetLambdaName`,
    });
  }
} 