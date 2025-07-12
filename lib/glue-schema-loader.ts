import * as fs from 'fs';
import * as path from 'path';
import * as glue from 'aws-cdk-lib/aws-glue';

export interface GlueTableSchema {
  name: string;
  description: string;
  tableType: string;
  parameters?: { [key: string]: string };
  storageDescriptor: {
    columns: Array<{
      name: string;
      type: string;
      comment?: string;
    }>;
    inputFormat: string;
    outputFormat: string;
    serdeInfo: {
      serializationLibrary: string;
      parameters?: { [key: string]: string };
    };
    bucketColumns?: string[];
    sortColumns?: Array<{ column: string; sortOrder: number }>;
    parameters?: { [key: string]: string };
  };
  partitionKeys?: Array<{ name: string; type: string; comment?: string }>;
  tableParameters?: { [key: string]: string };
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
  bucketArn: string
): glue.CfnTable {
  const tableInput: any = {
    name: schema.name,
    description: schema.description,
    tableType: schema.tableType,
    parameters: schema.parameters,
    storageDescriptor: {
      ...schema.storageDescriptor,
      location: bucketArn, // This will be overridden with specific paths
      bucketColumns: schema.storageDescriptor.bucketColumns || [],
      sortColumns: schema.storageDescriptor.sortColumns || [],
      parameters: schema.storageDescriptor.parameters || {},
    },
    partitionKeys: schema.partitionKeys || [],
  };
  
  // Add tableParameters if it exists
  if (schema.tableParameters) {
    tableInput.tableParameters = schema.tableParameters;
  }
  
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
  bucketArn: string,
  tablePath: string
): glue.CfnTable {
  const tableInput: any = {
    name: schema.name,
    description: schema.description,
    tableType: schema.tableType,
    parameters: schema.parameters,
    storageDescriptor: {
      ...schema.storageDescriptor,
      location: `${bucketArn}/${tablePath}`,
      bucketColumns: schema.storageDescriptor.bucketColumns || [],
      sortColumns: schema.storageDescriptor.sortColumns || [],
      parameters: schema.storageDescriptor.parameters || {},
    },
    partitionKeys: schema.partitionKeys || [],
  };
  
  // Add tableParameters if it exists
  if (schema.tableParameters) {
    tableInput.tableParameters = schema.tableParameters;
  }
  
  return new glue.CfnTable(scope, id, {
    catalogId: scope.account,
    databaseName: databaseName,
    tableInput: tableInput,
  });
} 