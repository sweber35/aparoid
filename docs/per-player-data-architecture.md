# Per-Player Data Architecture

This document describes the new per-player data architecture implemented in Aparoid, which provides more granular and user-centric data analysis capabilities.

## 🎯 **Overview**

The per-player data architecture extracts and stores individual player performance data from Super Smash Bros. Melee matches, while duplicating match-level data for each user. This approach provides better data organization, improved analysis capabilities, and enhanced privacy controls.

## 🏗️ **Data Organization**

### **Storage Structure**
```
processed-data/
├── player-data/
│   └── user_id=user_123/
│       ├── match_id=12345_frames.parquet          # User's frame data
│       ├── match_id=12345_attacks.parquet         # User's attack data
│       ├── match_id=12345_punishes.parquet        # User's punish data
│       └── match_id=12345_player-settings.jsonl   # User's character/settings
└── match-data/
    └── user_id=user_123/
        ├── match_id=12345_match-settings.jsonl    # Match configuration
        ├── match_id=12345_items.parquet           # Match items
        └── match_id=12345_platforms.parquet       # Stage platforms (if applicable)
```

### **Data Classification**

#### **Player-Specific Data** (Per-User)
- **frames.parquet**: Individual player frame data (position, damage, state)
- **attacks.parquet**: Player's attack data (hits, damage dealt)
- **punishes.parquet**: Player's punish sequences
- **player-settings.jsonl**: Player's character and controller settings

#### **Match-Level Data** (Duplicated per User)
- **match-settings.jsonl**: Match configuration, stage, rules
- **items.parquet**: Items that appear in the match
- **platforms.parquet**: Stage platforms (Fountain of Dreams, etc.)

## 🔄 **Processing Flow**

### **1. SLP File Upload**
```
User uploads SLP → Extract user_id from S3 key → Parse with slippc
```

### **2. Player Identification**
```
Parse SLP file → Extract match_id → Determine player_index → Extract player data
```

### **3. Data Extraction**
```
Extract player-specific data → Extract match-level data → Store in user partitions
```

### **4. Storage**
```
Store player data in player-data/user_id=X/ → Store match data in match-data/user_id=X/
```

## 📊 **Glue Table Schemas**

### **Player Frames Table**
```json
{
  "name": "player_frames",
  "columns": [
    {"name": "match_id", "type": "string"},
    {"name": "frame", "type": "int"},
    {"name": "position_x", "type": "float"},
    {"name": "position_y", "type": "float"},
    {"name": "damage", "type": "float"},
    {"name": "character", "type": "string"},
    {"name": "state", "type": "string"},
    {"name": "action", "type": "string"},
    {"name": "stocks", "type": "int"}
  ],
  "partitionKeys": [
    {"name": "user_id", "type": "string"}
  ]
}
```

### **Player Attacks Table**
```json
{
  "name": "player_attacks",
  "columns": [
    {"name": "match_id", "type": "string"},
    {"name": "frame", "type": "int"},
    {"name": "attack_type", "type": "string"},
    {"name": "damage_dealt", "type": "float"},
    {"name": "hit_opponent", "type": "boolean"},
    {"name": "character", "type": "string"}
  ],
  "partitionKeys": [
    {"name": "user_id", "type": "string"}
  ]
}
```

### **Player Punishes Table**
```json
{
  "name": "player_punishes",
  "columns": [
    {"name": "match_id", "type": "string"},
    {"name": "start_frame", "type": "int"},
    {"name": "end_frame", "type": "int"},
    {"name": "damage_dealt", "type": "float"},
    {"name": "punish_type", "type": "string"},
    {"name": "character", "type": "string"}
  ],
  "partitionKeys": [
    {"name": "user_id", "type": "string"}
  ]
}
```

## 🛠️ **Implementation Details**

### **SLP Processing Lambda Updates**

The SLP-to-parquet Lambda has been updated to:

1. **Extract player-specific data** from the SLP file
2. **Identify the user's player index** in the match
3. **Store player data** in user-specific partitions
4. **Duplicate match-level data** for each user
5. **Maintain data lineage** and access tracking

### **Key Functions**

#### **extractPlayerData()**
- Filters frame, attack, and punish data for specific player
- Creates player-specific data files
- Returns structured player data object

#### **extractMatchData()**
- Extracts match-level configuration and items
- Handles stage-specific data (platforms for FoD)
- Returns structured match data object

#### **storePlayerData()**
- Stores player-specific data in S3
- Uses user-based partitioning
- Maintains data organization

#### **storeMatchData()**
- Stores match-level data for each user
- Duplicates data for complete context
- Enables independent analysis

## 📈 **Benefits**

### **For Individual Users**
- **Personal Performance Tracking**: See your own improvement over time
- **Character Mastery**: Track performance with specific characters
- **Match History**: Your perspective of all matches
- **Privacy Control**: Your data stays in your partition

### **For Analysis**
- **User-Centric Queries**: "Show me all of user_123's matches"
- **Character Analysis**: "Show user_123's performance with Fox"
- **Performance Trends**: "Show user_123's improvement over time"
- **Comparative Analysis**: "Compare user_123 vs user_456"

### **For System Performance**
- **Efficient Queries**: Direct user-based partitioning
- **Better Caching**: Cache user-specific data
- **Reduced Complexity**: No need for complex deduplication
- **Scalable Architecture**: Easy to add new users

## 🔍 **Query Examples**

### **User's Match History**
```sql
SELECT match_id, character, damage, stocks
FROM player_frames
WHERE user_id = 'user_123'
  AND frame = 0  -- Start of match
ORDER BY match_id DESC
```

### **Character Performance**
```sql
SELECT character, 
       AVG(damage_dealt) as avg_damage,
       COUNT(*) as total_attacks
FROM player_attacks
WHERE user_id = 'user_123'
GROUP BY character
ORDER BY avg_damage DESC
```

### **Punish Analysis**
```sql
SELECT punish_type,
       AVG(damage_dealt) as avg_punish_damage,
       COUNT(*) as total_punishes
FROM player_punishes
WHERE user_id = 'user_123'
GROUP BY punish_type
```

## 🚀 **Migration Strategy**

### **Phase 1: New Uploads**
- Process new SLP uploads with per-player architecture
- Maintain backward compatibility for existing data
- Test with sample data

### **Phase 2: Data Migration**
- Migrate existing data to new structure
- Update Glue tables and schemas
- Verify data integrity

### **Phase 3: Full Deployment**
- Deploy updated frontend and analytics
- Enable new query capabilities
- Deprecate old data structures

## 🔮 **Future Enhancements**

### **Advanced Player Identification**
- **Slippi Code Matching**: Automatically identify player by slippi_code
- **Character Recognition**: Identify player by character selection
- **Controller Settings**: Match by controller configuration

### **Enhanced Analytics**
- **Player Comparisons**: Compare performance across players
- **Tournament Tracking**: Track performance in competitive settings
- **Goal Setting**: Set and track improvement goals

### **Performance Optimizations**
- **Data Compression**: Compress historical data
- **Caching Strategy**: Cache frequently accessed data
- **Batch Processing**: Process multiple matches efficiently

---

This per-player data architecture provides a solid foundation for user-centric analysis while maintaining the flexibility to support advanced analytics and community features. 