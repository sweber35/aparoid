import * as fs from 'fs';
import * as path from 'path';
import * as glue from 'aws-cdk-lib/aws-glue';

export interface GlueTableSchema {
  name: string;
  description: string;
  columns: Array<{
    name: string;
    type: string;
    comment?: string;
  }>;
  partitionKeys?: Array<{ name: string; type: string; comment?: string }>;
}

export function loadGlueSchema(schemaPath: string): GlueTableSchema {
  const fullPath = path.resolve(__dirname, '..', schemaPath);
  const schemaContent = fs.readFileSync(fullPath, 'utf8');
  return JSON.parse(schemaContent) as GlueTableSchema;
}

export function createGlueTableFromSchema(
  scope: any,
  id: string,
  schema: GlueTableSchema,
  databaseName: string,
  bucketLocation: string
): glue.CfnTable {
  const tableInput: any = {
    name: schema.name,
    description: schema.description,
    tableType: 'EXTERNAL_TABLE',
    parameters: {
      classification: 'parquet'
    },
    storageDescriptor: {
      columns: schema.columns,
      location: bucketLocation, // This will be overridden with specific paths
      inputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat',
      outputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat',
      serdeInfo: {
        serializationLibrary: 'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe',
        parameters: {
          'serialization.format': '1'
        }
      },
      bucketColumns: [],
      sortColumns: [],
      parameters: {},
    },
    partitionKeys: schema.partitionKeys || [],
    tableParameters: {
      EXTERNAL: 'TRUE'
    }
  };
  
  return new glue.CfnTable(scope, id, {
    catalogId: scope.account,
    databaseName: databaseName,
    tableInput: tableInput,
  });
}

export function createGlueTableWithLocation(
  scope: any,
  id: string,
  schema: GlueTableSchema,
  databaseName: string,
  bucketLocation: string,
  tablePath: string
): glue.CfnTable {
  const tableInput: any = {
    name: schema.name,
    description: schema.description,
    tableType: 'EXTERNAL_TABLE',
    parameters: {
      classification: 'parquet'
    },
    storageDescriptor: {
      columns: schema.columns,
      location: `${bucketLocation}/${tablePath}`,
      inputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat',
      outputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat',
      serdeInfo: {
        serializationLibrary: 'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe',
        parameters: {
          'serialization.format': '1'
        }
      },
      bucketColumns: [],
      sortColumns: [],
      parameters: {},
    },
    partitionKeys: schema.partitionKeys || [],
    tableParameters: {
      EXTERNAL: 'TRUE'
    }
  };
  
  return new glue.CfnTable(scope, id, {
    catalogId: scope.account,
    databaseName: databaseName,
    tableInput: tableInput,
  });
} 