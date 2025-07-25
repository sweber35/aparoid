# Multi-User Tenancy Implementation

## Overview

This document outlines the implementation of multi-user tenancy in Aparoid, transforming it into a SaaS product. The implementation uses **UUID-based user identifiers** for robust user identification and data isolation.

## Architecture

### 1. User Identification Strategy

**Solution**: Direct user identification system:
- **User ID**: Immutable UUID (`user_12345678-1234-1234-1234-123456789abc`)
- **Direct Usage**: User ID used directly for all data partitioning and access control
- **Required**: All requests must include user_id for data isolation

### 2. Data Storage Structure

#### S3 Bucket Organization
```
slp-replays/
├── user_12345678-1234-1234-1234-123456789abc/
│   ├── replay1.slp
│   └── replay2.slp
└── user_87654321-4321-4321-4321-cba987654321/
    └── replay3.slp

processed-data/
├── frames/
│   └── user_id=user_12345678-1234-1234-1234-123456789abc/
│       └── match_id=12345_frames.parquet
├── items/
│   └── user_id=user_12345678-1234-1234-1234-123456789abc/
│       └── match_id=12345_items.parquet
└── ...

replay-cache/
├── stubs/
│   ├── sequence/
│   │   └── user_12345678-1234-1234-1234-123456789abc/
│   │       └── actionsHash-matchId.json
│   └── combo/
│       └── user_12345678-1234-1234-1234-123456789abc/
│           └── comboType-matchId.json
└── replays/
    └── user_12345678-1234-1234-1234-123456789abc/
        └── matchId-frameStart-frameEnd.json
```

#### Glue Table Partitioning
All tables partition by `user_id`:
- `frames` table: `user_id` partition key
- `items` table: `user_id` partition key
- `attacks` table: `user_id` partition key
- `punishes` table: `user_id` partition key
- `match_settings` table: `user_id` partition key
- `player_settings` table: `user_id` partition key
- `platforms` table: `user_id` partition key

## Infrastructure

### 1. Storage Stack (`lib/storage-stack.ts`)

**Components**:
- Enhanced bucket policies using `aws:PrincipalTag/user_id`
- IAM role for user access control

**Bucket Policies**:
```typescript
// S3 bucket policies restrict access to user's own data
conditions: {
  'StringEquals': {
    'aws:PrincipalTag/user_id': '${aws:PrincipalTag/user_id}',
  },
  'StringLike': {
    's3:prefix': '${aws:PrincipalTag/user_id}/*',
  },
}
```

### 2. Processing Stack (`lib/processing-stack.ts`)

**Environment Variables**:
- Lambda functions configured for multi-tenant operation
- No feature flags required

**API Gateway Updates**:
- CORS headers include `X-User-ID`
- All Lambda functions require user_id

### 3. Glue Stack (`lib/glue-stack.ts`)

**Schema Updates**:
- All table schemas use `user_id` partition key
- Partition key definition in JSON schema files

## Lambda Functions

### 1. SLP to Parquet (`lambda/slp-to-parquet/index.js`)

**Key Features**:
- Extract `user_id` directly from S3 key path
- Store processed data with `user_id` partitioning
- Validate S3 key format: `user_id/filename.slp`

**Logic**:
```javascript
// Extract user_id from S3 key path
const keyParts = key.split('/');
if (keyParts.length < 2) {
  throw new Error('Invalid S3 key format. Expected: user_id/filename.slp');
}
const userId = keyParts[0];
```

### 2. Replay Stub (`lambda/replay-stub/index.js`)

**Key Features**:
- Extract `user_id` from request headers (`X-User-ID`)
- Validate `user_id` presence in all requests
- Cache results with user-specific paths
- Pass `user_id` to query generation functions

**Request Validation**:
```javascript
function extractUserId(event) {
  const headers = event.headers || {};
  const userId = headers['x-user-id'] || headers['X-User-ID'];
  
  if (userId) return userId;
  
  const body = JSON.parse(event.body || '{}');
  return body.user_id || body.userId || '';
}
```

### 3. Replay Data (`lambda/replay-data/index.js`)

**Key Features**:
- Extract `user_id` from request headers
- Filter all Athena queries by `user_id`
- Cache replay data with user-specific paths
- Support both full replay and frame range requests

**Query Filtering**:
```sql
-- All queries include user_id filter
WHERE match_id = '${matchId}' AND user_id = '${userId}'
```

### 4. Query Generation (`lambda/replay-stub/util.js`)

**Key Features**:
- `generateSequenceQuery()` requires `userId` parameter
- `generateComboQuery()` requires `userId` parameter
- All SQL queries include `user_id` filters

**Query Filtering**:
```sql
-- Add user_id filter to all table joins
WHERE ms.user_id = '${userId}' AND ps.user_id = '${userId}'
```

## Security Model

### 1. IAM Access Control

**User Access Role**:
- Lambda functions assume `aparoid-user-access-role`
- Role tagged with `user_id` for S3 access control
- Policies restrict access to user's own data partitions

### 2. S3 Bucket Policies

**Fine-grained Access Control**:
- Users can only access their own `user_id` prefixed data
- Policies use `aws:PrincipalTag/user_id` conditions
- Separate policies for each bucket (raw, processed, cache)

### 3. API Security

**Request Validation**:
- All requests require `user_id`
- Validation occurs at Lambda function level
- CORS headers configured for `X-User-ID`

## Configuration

### 1. API Headers

**Required for All Requests**:
```
X-User-ID: user_12345678-1234-1234-1234-123456789abc
```

### 2. Request Body

**Alternative User ID Source**:
```json
{
  "user_id": "user_12345678-1234-1234-1234-123456789abc",
  "matchId": "12345",
  "frameStart": 1000,
  "frameEnd": 2000
}
```

### 3. S3 Upload Format

**Required S3 Key Structure**:
```
user_12345678-1234-1234-1234-123456789abc/replay.slp
```

## Future Enhancements

### 1. Cognito Integration

**Planned Features**:
- User authentication and JWT validation
- Automatic user_id extraction from JWT tokens
- Role-based access control (RBAC)
- User profile management

### 2. Local Agent

**Planned Features**:
- Automatic replay file detection
- S3 upload with user authentication
- Real-time sync status
- Offline queue management

### 3. User Management

**Planned Features**:
- User registration and onboarding
- Account settings and preferences
- Usage analytics and limits

## Testing

### 1. Unit Tests

**Test Cases**:
- S3 path construction with user_id
- Query filtering with user_id
- Cache key generation
- User_id validation

### 2. Integration Tests

**Test Scenarios**:
- Multi-tenant data isolation
- Cross-user access prevention
- Cache isolation between users
- API response validation

### 3. Performance Tests

**Metrics**:
- Query performance with user_id filtering
- Cache hit rates per user
- S3 access patterns
- Lambda cold start impact

## Monitoring

### 1. CloudWatch Metrics

**Key Metrics**:
- S3 access patterns by user
- Cache hit/miss rates
- API response times
- User_id validation errors

### 2. Logging

**Structured Logs**:
- User ID in all Lambda logs
- Cache operations with user context
- Error tracking per user
- S3 key validation events

## Cost Considerations

### 1. Storage Costs

**Partitioning Benefits**:
- Reduced Athena query costs through partition pruning
- Efficient S3 access patterns
- Optimized cache storage

### 2. Compute Costs

**Lambda Optimization**:
- Efficient query filtering reduces data transfer
- Cache reduces repeated computations
- No feature flag overhead

### 3. Data Transfer

**Optimizations**:
- User-specific caching reduces repeated queries
- Partition pruning reduces data scanned
- Efficient S3 access patterns

## Conclusion

The multi-user tenancy implementation provides:

1. **Simple User Identification**: Direct UUID-based system without complexity
2. **Complete Data Isolation**: Users can only access their own data
3. **Scalable Architecture**: Partition-based design supports unlimited users
4. **Security First**: IAM policies enforce access control at infrastructure level
5. **Performance Optimized**: Partition pruning and user-specific caching
6. **Future Ready**: Foundation for Cognito and local agent integration
7. **Clean Architecture**: No backward compatibility complexity

This implementation transforms Aparoid into a production-ready SaaS platform with a clean, direct approach to user identification and data isolation. 