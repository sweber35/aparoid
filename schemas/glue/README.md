# Glue Table Schemas

This directory contains JSON schema definitions for AWS Glue tables. Each JSON file represents a single table schema that can be loaded by the CDK stack.

## Schema Structure

Each schema file should follow this simplified structure:

```json
{
  "name": "table_name",
  "description": "Table description",
  "columns": [
    {
      "name": "column_name",
      "type": "data_type",
      "comment": "Column description"
    }
  ],
  "partitionKeys": []
}
```

## Common Configuration

The following configuration is automatically applied to all tables by the CDK functions:

- **Table Type**: `EXTERNAL_TABLE`
- **Classification**: `parquet`
- **Input Format**: `org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat`
- **Output Format**: `org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat`
- **Serialization Library**: `org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe`
- **Table Parameters**: `EXTERNAL: TRUE`

## Adding New Schemas

1. Create a new JSON file in this directory (e.g., `my-table-schema.json`)
2. Follow the simplified structure above
3. Update the CDK stack to load the new schema file
4. Deploy the stack

## Current Schemas

- `frames-schema.json` - Frame-by-frame data from SLP replay files

## Data Types

Common Glue data types:
- `string` - Text data
- `int` - 32-bit integer
- `bigint` - 64-bit integer
- `tinyint` - 8-bit integer
- `smallint` - 16-bit integer
- `double` - Double precision floating point
- `float` - Single precision floating point
- `boolean` - Boolean data
- `timestamp` - Date/time data
- `array<type>` - Array of specified type
- `struct<field:type>` - Structured data

## Tips

- Use descriptive column names and comments
- Consider partitioning for large tables
- Use appropriate data types for your data
- Keep schemas version controlled 