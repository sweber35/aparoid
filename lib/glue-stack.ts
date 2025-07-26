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
  // public readonly createViewsLambda: lambda.Function; // Removed

  constructor(scope: Construct, id: string, props: GlueStackProps) {
    super(scope, id, props);

    // Glue database (for processed SLP data)
    this.glueDb = new glue.CfnDatabase(this, 'aparoid-replay-data-database', {
      catalogId: this.account,
      databaseInput: {
        name: `${this.account}-${this.region}-replay-data-db`,
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
      'jsonl'
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
      'jsonl'
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

    // Add attacks table
    const attacksSchema = loadGlueSchema('schemas/glue/attacks-schema.json');
    const attacksTable = createGlueTableWithLocation(
      this,
      'aparoid-attacks-table',
      attacksSchema,
      this.glueDb.ref,
      `s3://${props.processedDataBucketName}`,
      'attacks',
      'parquet'  // Note: attacks are output as Parquet from slippc
    );
    attacksTable.addDependency(this.glueDb);

    // Add punishes table
    const punishesSchema = loadGlueSchema('schemas/glue/punishes-schema.json');
    const punishesTable = createGlueTableWithLocation(
      this,
      'aparoid-punishes-table',
      punishesSchema,
      this.glueDb.ref,
      `s3://${props.processedDataBucketName}`,
      'punishes',
      'parquet'  // Note: punishes are output as Parquet from slippc
    );
    punishesTable.addDependency(this.glueDb);

    // Remove all code related to Glue/Athena view creation, Lambda, and custom resource
    // Only keep Glue tables and database logic

    // Output the database name for cross-stack references
    new cdk.CfnOutput(this, 'GlueDatabaseName', {
      value: this.glueDb.ref,
      description: 'Name of the Glue database for processed SLP data',
      exportName: `${this.stackName}-GlueDatabaseName`,
    });
  }
} 