const { DynamoDBClient, ScanCommand, DeleteItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');
const { S3Client, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
const s3 = new S3Client({ region: process.env.AWS_REGION });

// Get deduplication statistics
async function getDeduplicationStats() {
  try {
    const scanCommand = new ScanCommand({
      TableName: process.env.MATCH_DEDUPLICATION_TABLE,
      Select: 'COUNT'
    });
    
    const result = await dynamo.send(scanCommand);
    
    // Get processing status breakdown
    const processingQuery = new QueryCommand({
      TableName: process.env.MATCH_DEDUPLICATION_TABLE,
      IndexName: 'processing-status-index',
      KeyConditionExpression: 'processing_status = :status',
      ExpressionAttributeValues: {
        ':status': { S: 'completed' }
      },
      Select: 'COUNT'
    });
    
    const completedResult = await dynamo.send(processingQuery);
    
    return {
      totalMatches: result.Count,
      completedMatches: completedResult.Count,
      failedMatches: result.Count - completedResult.Count
    };
  } catch (error) {
    console.error('Error getting deduplication stats:', error);
    throw error;
  }
}

// Clean up orphaned data (data without deduplication records)
async function cleanupOrphanedData() {
  try {
    console.log('Starting orphaned data cleanup...');
    
    // List all objects in the processed data bucket
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.PROCESSED_DATA_BUCKET,
      MaxKeys: 1000
    });
    
    const result = await s3.send(listCommand);
    const orphanedKeys = [];
    
    // Check each object against the deduplication table
    for (const object of result.Contents || []) {
      const key = object.Key;
      
      // Extract match_id from S3 key
      const matchIdMatch = key.match(/match_id=([^_]+)/);
      if (!matchIdMatch) continue;
      
      const matchId = matchIdMatch[1];
      
      // Check if match exists in deduplication table
      const getCommand = {
        TableName: process.env.MATCH_DEDUPLICATION_TABLE,
        Key: {
          match_id: { S: matchId }
        }
      };
      
      try {
        await dynamo.send(getCommand);
        // Match exists, not orphaned
      } catch (error) {
        if (error.name === 'ResourceNotFoundException') {
          // Match doesn't exist in table, mark as orphaned
          orphanedKeys.push(key);
        }
      }
    }
    
    console.log(`Found ${orphanedKeys.length} orphaned objects`);
    
    // Delete orphaned objects
    for (const key of orphanedKeys) {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: process.env.PROCESSED_DATA_BUCKET,
        Key: key
      });
      
      await s3.send(deleteCommand);
      console.log(`Deleted orphaned object: ${key}`);
    }
    
    return {
      orphanedObjectsFound: orphanedKeys.length,
      orphanedObjectsDeleted: orphanedKeys.length
    };
    
  } catch (error) {
    console.error('Error cleaning up orphaned data:', error);
    throw error;
  }
}

// Get user access statistics
async function getUserAccessStats() {
  try {
    const scanCommand = new ScanCommand({
      TableName: process.env.MATCH_DEDUPLICATION_TABLE,
      ProjectionExpression: 'match_id, user_access, created_at'
    });
    
    const result = await dynamo.send(scanCommand);
    
    const stats = {
      totalMatches: result.Items.length,
      matchesWithMultipleUsers: 0,
      totalUserAccesses: 0,
      averageUsersPerMatch: 0
    };
    
    for (const item of result.Items) {
      const userAccess = item.user_access?.SS || [];
      stats.totalUserAccesses += userAccess.length;
      
      if (userAccess.length > 1) {
        stats.matchesWithMultipleUsers++;
      }
    }
    
    if (stats.totalMatches > 0) {
      stats.averageUsersPerMatch = stats.totalUserAccesses / stats.totalMatches;
    }
    
    return stats;
    
  } catch (error) {
    console.error('Error getting user access stats:', error);
    throw error;
  }
}

// Main handler
exports.handler = async (event) => {
  const { action } = event;
  
  try {
    switch (action) {
      case 'getStats':
        return await getDeduplicationStats();
        
      case 'cleanupOrphaned':
        return await cleanupOrphanedData();
        
      case 'getUserAccessStats':
        return await getUserAccessStats();
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Error in match deduplication utils:', error);
    throw error;
  }
}; 