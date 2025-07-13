import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as glue from 'aws-cdk-lib/aws-glue';
import { loadGlueSchema, createGlueTableWithLocation } from './glue-schema-loader';

export class DatalakeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const slpReplayBucket = new s3.Bucket(this, 'aparoid-slp-replays', {
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT for production!
      autoDeleteObjects: true,
    });

    const processedSlpDataBucket = new s3.Bucket(this, 'aparoid-slp-data', {
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });


    // Glue database (for processed SLP data)
    const glueDb = new glue.CfnDatabase(this, 'aparoid-replay-data-db', {
      catalogId: this.account,
      databaseInput: {
        name: 'replay-data-db',
        description: 'Database for processed SLP data',
      },
    });

    const framesSchema = loadGlueSchema('schemas/glue/frames-schema.json');
    const framesTable = createGlueTableWithLocation(
      this,
      'frames-table',
      framesSchema,
      glueDb.ref,
      `s3://${processedSlpDataBucket.bucketName}`,
      'frames'
    );
    framesTable.addDependency(glueDb);

    // Lambda layer for slippc binary
    const slippcLayer = new lambda.LayerVersion(this, 'SlippcLayer', {
      code: lambda.Code.fromAsset('lambda-layers/slippc-layer'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'Layer containing slippc binary for SLP file parsing',
    });

    // Lambda function: slp-to-parquet
    const slpToParquetLambda = new lambda.Function(this, 'slp-to-parquet-lambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/slp-to-parquet'),
      layers: [slippcLayer],
      environment: {
        SLIPPI_CODE: process.env.SLIPPI_CODE || '',
        SLIPPI_USER_ID: process.env.SLIPPI_USER_ID || '',
        DEPLOYMENT_REGION: this.region, // Pass the deployment region to Lambda
        PROCESSED_DATA_BUCKET: processedSlpDataBucket.bucketName, // Pass the destination bucket name
      },
      timeout: cdk.Duration.minutes(1),
      memorySize: 256,
    });
    // Grant Lambda access to S3 buckets
    slpReplayBucket.grantRead(slpToParquetLambda);
    processedSlpDataBucket.grantWrite(slpToParquetLambda);

    // S3 event notification to Lambda - only for objects in /slp folder
    slpReplayBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(slpToParquetLambda),
      {
        prefix: 'slp/'  // Only trigger for objects in the /slp folder
      }
    );
  }
}
