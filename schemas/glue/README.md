# Glue Table Schemas

This directory contains JSON schema definitions for AWS Glue tables. Each JSON file represents a single table schema that can be loaded by the CDK stack.

## Schema Structure

Each schema file should follow this structure:

```json
{
  "name": "table_name",
  "description": "Table description",
  "tableType": "EXTERNAL_TABLE",
  "parameters": {
    "classification": "parquet",
    "compressionType": "snappy"
  },
  "storageDescriptor": {
    "columns": [
      {
        "name": "column_name",
        "type": "data_type",
        "comment": "Column description"
      }
    ],
    "inputFormat": "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat",
    "outputFormat": "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat",
    "serdeInfo": {
      "serializationLibrary": "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
    }
  },
  "partitionKeys": [],
  "tableParameters": {
    "EXTERNAL": "TRUE"
  }
}
```

## Adding New Schemas

1. Create a new JSON file in this directory (e.g., `my-table-schema.json`)
2. Follow the structure above
3. Update the CDK stack to load the new schema file
4. Deploy the stack

## Current Schemas

- `processed-slp-table.json` - Raw processed SLP data
- `player-stats-table.json` - Aggregated player statistics

## Data Types

Common Glue data types:
- `string` - Text data
- `int` - 32-bit integer
- `bigint` - 64-bit integer
- `double` - Double precision floating point
- `timestamp` - Date/time data
- `array<type>` - Array of specified type
- `struct<field:type>` - Structured data

## Tips

- Use descriptive column names and comments
- Consider partitioning for large tables
- Use appropriate compression (SNAPPY for parquet)
- Keep schemas version controlled 