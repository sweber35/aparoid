# Parquet Partitioning Strategy Analysis

This document analyzes the trade-offs between different partitioning strategies for Parquet files in the Aparoid data lake, specifically addressing the question of whether to implement broader bucket partitioning (e.g., by month) for file consolidation.

## 📊 **Current Architecture**

### **Existing Partitioning**
```
processed-data/
├── player-data/
│   └── user_id=user_123/
│       ├── match_id=12345_frames.parquet          # ~50-200KB per match
│       ├── match_id=12345_attacks.parquet         # ~10-50KB per match
│       └── match_id=12345_punishes.parquet        # ~5-20KB per match
└── match-data/
    └── user_id=user_123/
        ├── match_id=12345_match-settings.jsonl    # ~1-5KB per match
        ├── match_id=12345_items.parquet           # ~5-15KB per match
        └── match_id=12345_platforms.parquet       # ~1-10KB per match
```

### **File Size Estimates**
- **Per-match files**: 50-300KB total per match
- **Active user**: ~100-500 matches/month = 5-150MB/month
- **Heavy user**: ~1000+ matches/month = 50-300MB/month

## 🎯 **Partitioning Strategy Options**

### **Option 1: Current Approach (Match-Level Partitioning)**
```
user_id=user_123/match_id=12345_frames.parquet
```

**Pros:**
- ✅ **Immediate data availability**: Files available as soon as processed
- ✅ **Simple queries**: Direct match-level access
- ✅ **No batch processing complexity**: Real-time processing
- ✅ **Easy debugging**: Individual match files for troubleshooting
- ✅ **User isolation**: Perfect for multi-tenant security

**Cons:**
- ❌ **Many small files**: Poor Parquet performance
- ❌ **S3 overhead**: More API calls, higher costs
- ❌ **Query inefficiency**: Multiple file reads for time-range queries

### **Option 2: Monthly Partitioning with Consolidation**
```
user_id=user_123/year=2024/month=03/frames.parquet  # Contains all March matches
```

**Pros:**
- ✅ **Optimal Parquet performance**: Larger files (5-50MB+)
- ✅ **Better compression**: Column-level compression across matches
- ✅ **Reduced S3 costs**: Fewer API calls
- ✅ **Efficient time-range queries**: Single file reads for monthly data

**Cons:**
- ❌ **Delayed data availability**: Requires batch consolidation
- ❌ **Complex batch processing**: Need recurring Lambda/Glue jobs
- ❌ **Loss of match-level partitioning**: Harder to query specific matches
- ❌ **Operational complexity**: More moving parts to maintain

### **Option 3: Hybrid Approach (Recommended)**
```
processed-data/
├── player-data/
│   └── user_id=user_123/
│       ├── current/                              # Real-time processing
│       │   ├── match_id=12345_frames.parquet
│       │   └── match_id=12346_frames.parquet
│       └── consolidated/                         # Batch consolidated
│           ├── year=2024/month=03/frames.parquet
│           └── year=2024/month=02/frames.parquet
└── match-data/
    └── user_id=user_123/
        ├── current/                              # Real-time processing
        └── consolidated/                         # Batch consolidated
```

## 📈 **Performance Analysis**

### **Parquet File Size Recommendations**
- **Optimal size**: 50MB - 1GB per file
- **Minimum size**: 10MB for good compression
- **Current size**: 50-300KB (too small)

### **Query Performance Comparison**

#### **Time-Range Queries (e.g., "Last 3 months")**
```
Current: 90+ file reads (one per match)
Monthly: 3 file reads (one per month)
Hybrid: 3 file reads (consolidated) + N file reads (current)
```

#### **Specific Match Queries**
```
Current: 1 file read (direct match access)
Monthly: 1 file read + row filtering
Hybrid: 1 file read (current) OR 1 file read + row filtering (consolidated)
```

## 🏗️ **Recommended Implementation: Hybrid Strategy**

### **Phase 1: Immediate Implementation**
1. **Keep current match-level partitioning** for real-time processing
2. **Add monthly consolidation** as a separate process
3. **Implement data lifecycle management**

### **Phase 2: Consolidation Process**
```javascript
// Monthly consolidation Lambda
async function consolidateMonthlyData(userId, year, month) {
  const sourcePrefix = `player-data/user_id=${userId}/current/`;
  const destPrefix = `player-data/user_id=${userId}/consolidated/year=${year}/month=${month}/`;
  
  // Read all match files for the month
  const matchFiles = await listMatchFiles(sourcePrefix, year, month);
  
  // Consolidate into monthly files
  await consolidateFiles(matchFiles, destPrefix);
  
  // Update Glue table partitions
  await updateGluePartitions(destPrefix);
}
```

### **Phase 3: Query Optimization**
```sql
-- Optimized query strategy
SELECT * FROM player_frames 
WHERE user_id = 'user_123' 
  AND match_id = 'specific_match'  -- Use current partition
  AND frame BETWEEN 1000 AND 2000;

-- Time-range query
SELECT * FROM player_frames 
WHERE user_id = 'user_123' 
  AND year = 2024 
  AND month = 03  -- Use consolidated partition
  AND frame BETWEEN 1000 AND 2000;
```

## 🔄 **Data Lifecycle Management**

### **File Lifecycle Rules**
```
S3 Lifecycle Policy:
├── Current files (0-7 days): Standard storage
├── Recent files (7-30 days): Standard storage  
├── Monthly files (30+ days): Move to IA
└── Consolidated files (90+ days): Move to IA
```

### **Consolidation Schedule**
```
Daily: Process new matches (real-time)
Weekly: Consolidate previous week's data
Monthly: Full monthly consolidation + cleanup
```

## 💰 **Cost Analysis**

### **S3 Storage Costs**
```
Current approach:
- 1000 matches/month × 200KB = 200MB
- 12 months × 200MB = 2.4GB
- Cost: ~$0.06/month

Monthly consolidation:
- 12 files × 200MB = 2.4GB  
- Cost: ~$0.06/month
- + Batch processing costs: ~$0.01/month
```

### **Query Costs (Athena)**
```
Current approach:
- 100 queries/month × 90 files = 9,000 file reads
- Cost: ~$0.45/month

Monthly consolidation:
- 100 queries/month × 12 files = 1,200 file reads
- Cost: ~$0.06/month
```

## 🎯 **Recommendation: Hybrid Approach**

### **Why Hybrid is Optimal**

1. **Best of Both Worlds**: Real-time processing + optimized queries
2. **Gradual Migration**: Can implement incrementally
3. **User Experience**: Immediate data availability
4. **Cost Efficiency**: Reduced query costs over time
5. **Operational Flexibility**: Can adjust consolidation frequency

### **Implementation Priority**

#### **High Priority (Immediate)**
- ✅ Keep current match-level partitioning
- ✅ Implement monthly consolidation Lambda
- ✅ Add data lifecycle management

#### **Medium Priority (Next Sprint)**
- ✅ Update Glue tables for hybrid partitioning
- ✅ Implement query optimization logic
- ✅ Add monitoring and alerting

#### **Low Priority (Future)**
- ✅ Consider quarterly/yearly consolidation
- ✅ Implement data archival strategies
- ✅ Add advanced compression options

## 📋 **Implementation Plan**

### **Step 1: Add Monthly Consolidation**
```typescript
// Add to ProcessingStack
const monthlyConsolidationLambda = new lambda.Function(this, 'MonthlyConsolidation', {
  functionName: 'aparoid-monthly-consolidation',
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda/monthly-consolidation'),
  environment: {
    PROCESSED_DATA_BUCKET: props.processedDataBucketName,
    GLUE_DATABASE: props.glueDatabaseName,
  },
  timeout: cdk.Duration.minutes(15),
});
```

### **Step 2: Update Glue Tables**
```typescript
// Add consolidated table partitions
const consolidatedTable = createGlueTableWithLocation(
  scope,
  'player-frames-consolidated',
  playerFramesSchema,
  databaseName,
  bucketLocation,
  'player-data/consolidated'
);
```

### **Step 3: Implement Query Strategy**
```typescript
// Smart query routing
function getOptimalQueryStrategy(userId, timeRange, matchId) {
  if (matchId) {
    return 'current'; // Use match-level partition
  }
  
  if (timeRange.days <= 7) {
    return 'current'; // Use recent files
  }
  
  return 'consolidated'; // Use monthly partitions
}
```

## 🔮 **Future Considerations**

### **Advanced Optimizations**
- **Column-level partitioning**: Partition by character, stage, etc.
- **Compression algorithms**: ZSTD, LZ4 for better compression ratios
- **Data skipping**: Implement min/max statistics for better filtering
- **Caching layer**: Redis/ElastiCache for frequently accessed data

### **Scalability Planning**
- **Multi-region**: Consider data locality for global users
- **Sharding**: Split large user datasets across multiple files
- **Streaming**: Real-time data processing with Kinesis/Flink

---

This hybrid approach provides the optimal balance between real-time data availability and query performance, while maintaining the flexibility to evolve the architecture as the system scales. 