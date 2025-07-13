import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';
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

    // Auto-populate processed data bucket with lookup data
    new s3deploy.BucketDeployment(this, 'DeployLookupData', {
      sources: [s3deploy.Source.asset('lookup-data')],
      destinationBucket: processedSlpDataBucket,
      destinationKeyPrefix: 'lookup',
    });

    new dynamodb.Table(this, 'replay-tags-table', {
      tableName: 'replay-tags',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT for production!
    });

    // Glue database (for processed SLP data)
    const glueDb = new glue.CfnDatabase(this, 'aparoid-replay-data-db', {
      catalogId: this.account,
      databaseInput: {
        name: 'replay-data-db',
        description: 'Database for processed SLP data',
        parameters: {
          'hive.metastore.database.owner': 'hadoop',
          'hive.metastore.database.owner-type': 'USER'
        }
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

    const itemsSchema = loadGlueSchema('schemas/glue/items-schema.json');
    const itemsTable = createGlueTableWithLocation(
      this,
      'items-table',
      itemsSchema,
      glueDb.ref,
      `s3://${processedSlpDataBucket.bucketName}`,
      'items'
    );
    itemsTable.addDependency(glueDb);

    const platformsSchema = loadGlueSchema('schemas/glue/platforms-schema.json');
    const platformsTable = createGlueTableWithLocation(
      this,
      'platforms-table',
      platformsSchema,
      glueDb.ref,
      `s3://${processedSlpDataBucket.bucketName}`,
      'platforms'
    );
    platformsTable.addDependency(glueDb);

    const matchSettingsSchema = loadGlueSchema('schemas/glue/match-settings-schema.json');
    const matchSettingsTable = createGlueTableWithLocation(
      this,
      'match-settings-table',
      matchSettingsSchema,
      glueDb.ref,
      `s3://${processedSlpDataBucket.bucketName}`,
      'match-settings',
      'json'
    );
    matchSettingsTable.addDependency(glueDb);

    const playerSettingsSchema = loadGlueSchema('schemas/glue/player-settings-schema.json');
    const playerSettingsTable = createGlueTableWithLocation(
      this,
      'player-settings-table',
      playerSettingsSchema,
      glueDb.ref,
      `s3://${processedSlpDataBucket.bucketName}`,
      'player-settings',
      'json'
    );
    playerSettingsTable.addDependency(glueDb);

    const lookupSchema = loadGlueSchema('schemas/glue/lookup-schema.json');
    const lookupTable = createGlueTableWithLocation(
      this,
      'lookup-table',
      lookupSchema,
      glueDb.ref,
      `s3://${processedSlpDataBucket.bucketName}`,
      'lookup',
      'json'
    );
    lookupTable.addDependency(glueDb);

    // Lambda function to create Glue views
    const createViewsLambda = new lambda.Function(this, 'create-glue-views-lambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/create-glue-views'),
      environment: {
        GLUE_DATABASE_NAME: glueDb.ref,
        REGION: this.region,
      },
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
    });

    // Grant Lambda permissions to create Glue views
    createViewsLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'glue:CreateTable',
        'glue:DeleteTable',
        'glue:GetTable',
        'glue:GetTables',
        'glue:UpdateTable',
        'glue:BatchCreatePartition',
        'glue:BatchDeletePartition',
        'glue:BatchGetPartition',
        'glue:GetPartition',
        'glue:GetPartitions',
        'glue:UpdatePartition',
        'glue:DeletePartition',
        'glue:CreatePartition',
        'glue:GetDatabase',
        'glue:GetDatabases',
        'glue:CreateDatabase',
        'glue:UpdateDatabase',
      ],
      resources: [
        `arn:aws:glue:${this.region}:${this.account}:catalog`,
        `arn:aws:glue:${this.region}:${this.account}:database/${glueDb.ref}`,
        `arn:aws:glue:${this.region}:${this.account}:table/${glueDb.ref}/*`,
      ],
    }));

    // Custom resource to trigger view creation after all tables are created
    const createViewsResource = new cr.AwsCustomResource(this, 'CreateGlueViews', {
      onCreate: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: createViewsLambda.functionName,
          InvocationType: 'RequestResponse',
        },
        physicalResourceId: cr.PhysicalResourceId.of('GlueViewsCreation'),
      },
      onUpdate: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: createViewsLambda.functionName,
          InvocationType: 'RequestResponse',
        },
        physicalResourceId: cr.PhysicalResourceId.of('GlueViewsCreation'),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['lambda:InvokeFunction'],
          resources: [createViewsLambda.functionArn],
        }),
      ]),
    });

    // Ensure views are created after all tables
    createViewsResource.node.addDependency(framesTable);
    createViewsResource.node.addDependency(itemsTable);
    createViewsResource.node.addDependency(platformsTable);
    createViewsResource.node.addDependency(matchSettingsTable);
    createViewsResource.node.addDependency(playerSettingsTable);
    createViewsResource.node.addDependency(lookupTable);

    const slippcLayer = new lambda.LayerVersion(this, 'SlippcLayer', {
      code: lambda.Code.fromAsset('lambda-layers/slippc-layer'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'Layer containing slippc binary for SLP file parsing',
    });

    const slpToParquetLambda = new lambda.Function(this, 'slp-to-parquet-lambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/slp-to-parquet'),
      layers: [slippcLayer],
      environment: {
        SLIPPI_CODE: process.env.SLIPPI_CODE || '',
        SLIPPI_USER_ID: process.env.SLIPPI_USER_ID || '',
        DEPLOYMENT_REGION: this.region,
        PROCESSED_DATA_BUCKET: processedSlpDataBucket.bucketName,
      },
      timeout: cdk.Duration.minutes(1),
      memorySize: 256,
    });

    slpReplayBucket.grantRead(slpToParquetLambda);
    processedSlpDataBucket.grantWrite(slpToParquetLambda);

    slpReplayBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(slpToParquetLambda)
    );
  }
}
