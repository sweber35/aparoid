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
  bucketLocation: string,
  format: 'parquet' | 'json' = 'parquet'
): glue.CfnTable {
  const tableInput = createTableInput(schema, bucketLocation, format);
  
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
  tablePath: string,
  format: 'parquet' | 'json' = 'parquet'
): glue.CfnTable {
  const tableInput = createTableInput(schema, `${bucketLocation}/${tablePath}`, format);
  
  return new glue.CfnTable(scope, id, {
    catalogId: scope.account,
    databaseName: databaseName,
    tableInput: tableInput,
  });
}

function createTableInput(schema: GlueTableSchema, location: string, format: 'parquet' | 'json'): any {
  const baseTableInput = {
    name: schema.name,
    description: schema.description,
    tableType: 'EXTERNAL_TABLE',
    storageDescriptor: {
      columns: schema.columns,
      location: location,
      bucketColumns: [],
      sortColumns: [],
      parameters: {},
    },
    partitionKeys: schema.partitionKeys || [],
    tableParameters: {
      EXTERNAL: 'TRUE'
    }
  };

  if (format === 'parquet') {
    return {
      ...baseTableInput,
      parameters: {
        classification: 'parquet'
      },
      storageDescriptor: {
        ...baseTableInput.storageDescriptor,
        inputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat',
        outputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat',
        serdeInfo: {
          serializationLibrary: 'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe',
          parameters: {
            'serialization.format': '1'
          }
        }
      }
    };
  } else if (format === 'json') {
    return {
      ...baseTableInput,
      parameters: {
        classification: 'json'
      },
      storageDescriptor: {
        ...baseTableInput.storageDescriptor,
        inputFormat: 'org.apache.hadoop.mapred.TextInputFormat',
        outputFormat: 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat',
        serdeInfo: {
          serializationLibrary: 'org.openx.data.jsonserde.JsonSerDe',
          parameters: {
            'serialization.format': '1'
          }
        }
      }
    };
  }

  throw new Error(`Unsupported format: ${format}. Supported formats are 'parquet' and 'json'`);
} 