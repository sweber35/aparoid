import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { loadGlueSchema, createGlueTableWithLocation } from '../util/glue-schema-loader';

export interface GlueStackProps extends cdk.StackProps {
  processedDataBucketName: string;
}

export class GlueStack extends cdk.Stack {
  public readonly glueDb: glue.CfnDatabase;
  public readonly createViewsLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: GlueStackProps) {
    super(scope, id, props);

    // Glue database (for processed SLP data)
    this.glueDb = new glue.CfnDatabase(this, 'aparoid-replay-data-database', {
      catalogId: this.account,
      databaseInput: {
        name: `replay-data-db`,
        description: 'Database for processed SLP data',
        parameters: {
          'hive.metastore.database.owner': 'hadoop',
          'hive.metastore.database.owner-type': 'USER'
        }
      },
    });

    // Create Glue tables
    const framesSchema = loadGlueSchema('schemas/glue/frames-schema.json');
    const framesTable = createGlueTableWithLocation(
      this,
      'aparoid-frames-table',
      framesSchema,
      this.glueDb.ref,
      `s3://${props.processedDataBucketName}`,
      'frames'
    );
    framesTable.addDependency(this.glueDb);

    const itemsSchema = loadGlueSchema('schemas/glue/items-schema.json');
    const itemsTable = createGlueTableWithLocation(
      this,
      'aparoid-items-table',
      itemsSchema,
      this.glueDb.ref,
      `s3://${props.processedDataBucketName}`,
      'items'
    );
    itemsTable.addDependency(this.glueDb);

    const platformsSchema = loadGlueSchema('schemas/glue/platforms-schema.json');
    const platformsTable = createGlueTableWithLocation(
      this,
      'aparoid-platforms-table',
      platformsSchema,
      this.glueDb.ref,
      `s3://${props.processedDataBucketName}`,
      'platforms'
    );
    platformsTable.addDependency(this.glueDb);

    const matchSettingsSchema = loadGlueSchema('schemas/glue/match-settings-schema.json');
    const matchSettingsTable = createGlueTableWithLocation(
      this,
      'aparoid-match-settings-table',
      matchSettingsSchema,
      this.glueDb.ref,
      `s3://${props.processedDataBucketName}`,
      'match-settings',
      'json'
    );
    matchSettingsTable.addDependency(this.glueDb);

    const playerSettingsSchema = loadGlueSchema('schemas/glue/player-settings-schema.json');
    const playerSettingsTable = createGlueTableWithLocation(
      this,
      'aparoid-player-settings-table',
      playerSettingsSchema,
      this.glueDb.ref,
      `s3://${props.processedDataBucketName}`,
      'player-settings',
      'json'
    );
    playerSettingsTable.addDependency(this.glueDb);

    const lookupSchema = loadGlueSchema('schemas/glue/lookup-schema.json');
    const lookupTable = createGlueTableWithLocation(
      this,
      'aparoid-lookup-table',
      lookupSchema,
      this.glueDb.ref,
      `s3://${props.processedDataBucketName}`,
      'lookup',
      'json'
    );
    lookupTable.addDependency(this.glueDb);

    // Create explicit CloudWatch log group for the Lambda function
    const lambdaLogGroup = new logs.LogGroup(this, 'aparoid-create-glue-views-logs', {
      logGroupName: `/aws/lambda/aparoid-create-glue-views`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_WEEK,
    });

    // Lambda function to create Glue views
    this.createViewsLambda = new lambda.Function(this, 'aparoid-create-glue-views-lambda', {
      functionName: `aparoid-create-glue-views`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/create-glue-views'),
      environment: {
        GLUE_DATABASE_NAME: this.glueDb.ref,
        REGION: this.region,
      },
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      logGroup: lambdaLogGroup, // Use the explicit log group
    });

    // Grant Lambda permissions to create Glue views
    this.createViewsLambda.addToRolePolicy(new iam.PolicyStatement({
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
        `arn:aws:glue:${this.region}:${this.account}:database/${this.glueDb.ref}`,
        `arn:aws:glue:${this.region}:${this.account}:table/${this.glueDb.ref}/*`,
      ],
    }));

    // Custom resource to trigger view creation after all tables are created
    const createViewsResource = new cr.AwsCustomResource(this, 'aparoid-create-glue-views-resource', {
      onCreate: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: this.createViewsLambda.functionName,
          InvocationType: 'RequestResponse',
        },
        physicalResourceId: cr.PhysicalResourceId.of('GlueViewsCreation'),
      },
      onUpdate: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: this.createViewsLambda.functionName,
          InvocationType: 'RequestResponse',
        },
        physicalResourceId: cr.PhysicalResourceId.of('GlueViewsCreation'),
      },
      onDelete: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: this.createViewsLambda.functionName,
          InvocationType: 'RequestResponse',
        },
        physicalResourceId: cr.PhysicalResourceId.of('GlueViewsCreation'),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['lambda:InvokeFunction'],
          resources: [this.createViewsLambda.functionArn],
        }),
      ]),
      // Add timeout and retry configuration for better reliability
      timeout: cdk.Duration.minutes(10),
      installLatestAwsSdk: false,
    });

    // Ensure views are created after all tables
    createViewsResource.node.addDependency(framesTable);
    createViewsResource.node.addDependency(itemsTable);
    createViewsResource.node.addDependency(platformsTable);
    createViewsResource.node.addDependency(matchSettingsTable);
    createViewsResource.node.addDependency(playerSettingsTable);
    createViewsResource.node.addDependency(lookupTable);

    // Output the database name for cross-stack references
    new cdk.CfnOutput(this, 'GlueDatabaseName', {
      value: this.glueDb.ref,
      description: 'Name of the Glue database for processed SLP data',
      exportName: `${this.stackName}-GlueDatabaseName`,
    });
  }
} 