const fs = require('fs').promises;
const path = require('path');
const { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');
const { execFile } = require('child_process');

// Get region from environment variable or default to us-east-1
const region = process.env.DEPLOYMENT_REGION || process.env.AWS_REGION || 'us-east-1';
const s3 = new S3Client({ region: region, defaultsMode: "legacy" });
const dynamo = new DynamoDBClient({ region: region });

// Convert S3 stream to buffer
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Check if match has already been processed
async function checkMatchExists(matchId) {
  try {
    const command = new GetItemCommand({
      TableName: process.env.MATCH_DEDUPLICATION_TABLE,
      Key: {
        match_id: { S: matchId }
      }
    });
    
    const result = await dynamo.send(command);
    return result.Item;
  } catch (error) {
    console.error('Error checking match existence:', error);
    return null;
  }
}

// Record match processing and user access
async function recordMatchProcessing(matchId, userId, processingStatus = 'completed') {
  try {
    const timestamp = new Date().toISOString();
    
    // Check if match already exists
    const existingMatch = await checkMatchExists(matchId);
    
    if (existingMatch) {
      // Update existing match record to add user access
      const updateCommand = new UpdateItemCommand({
        TableName: process.env.MATCH_DEDUPLICATION_TABLE,
        Key: {
          match_id: { S: matchId }
        },
        UpdateExpression: 'ADD user_access :userId SET updated_at = :timestamp',
        ExpressionAttributeValues: {
          ':userId': { SS: [userId] },
          ':timestamp': { S: timestamp }
        }
      });
      
      await dynamo.send(updateCommand);
      console.log(`Added user ${userId} to existing match ${matchId}`);
    } else {
      // Create new match record
      const putCommand = new PutItemCommand({
        TableName: process.env.MATCH_DEDUPLICATION_TABLE,
        Item: {
          match_id: { S: matchId },
          user_id: { S: userId }, // First user to process this match
          user_access: { SS: [userId] },
          processing_status: { S: processingStatus },
          created_at: { S: timestamp },
          updated_at: { S: timestamp },
          processed_by: { S: userId }
        }
      });
      
      await dynamo.send(putCommand);
      console.log(`Created new match record for ${matchId} by user ${userId}`);
    }
  } catch (error) {
    console.error('Error recording match processing:', error);
    throw error;
  }
}

// Check if processed data already exists in S3
async function checkProcessedDataExists(matchId, userId) {
  const baseKey = `user_id=${userId}/match_id=${matchId}`;
  const filesToCheck = [
    `${baseKey}_frames.parquet`,
    `${baseKey}_match-settings.jsonl`,
    `${baseKey}_player-settings.jsonl`
  ];
  
  try {
    for (const fileKey of filesToCheck) {
      const command = new HeadObjectCommand({
        Bucket: process.env.PROCESSED_DATA_BUCKET,
        Key: fileKey
      });
      
      await s3.send(command);
    }
    return true; // All files exist
  } catch (error) {
    if (error.name === 'NotFound') {
      return false; // Files don't exist
    }
    throw error; // Other error
  }
}

// Copy existing processed data for a new user
async function copyExistingMatchData(matchId, newUserId, existingMatch) {
  try {
    const originalUserId = existingMatch.user_id.S;
    console.log(`Copying match ${matchId} data from user ${originalUserId} to user ${newUserId}`);
    
    // Define the file types to copy
    const fileTypes = [
      'frames.parquet',
      'items.parquet', 
      'attacks.parquet',
      'punishes.parquet',
      'match-settings.jsonl',
      'player-settings.jsonl',
      'platforms.parquet' // Optional, only if exists
    ];
    
    for (const fileType of fileTypes) {
      const sourceKey = `user_id=${originalUserId}/match_id=${matchId}_${fileType}`;
      const destKey = `user_id=${newUserId}/match_id=${matchId}_${fileType}`;
      
      try {
        // Check if source file exists
        await s3.send(new HeadObjectCommand({
          Bucket: process.env.PROCESSED_DATA_BUCKET,
          Key: sourceKey
        }));
        
        // Copy the file
        const copyCommand = {
          Bucket: process.env.PROCESSED_DATA_BUCKET,
          CopySource: `${process.env.PROCESSED_DATA_BUCKET}/${sourceKey}`,
          Key: destKey
        };
        
        await s3.send(new PutObjectCommand(copyCommand));
        console.log(`Copied ${sourceKey} to ${destKey}`);
        
      } catch (error) {
        if (error.name === 'NotFound') {
          console.log(`Source file ${sourceKey} not found, skipping`);
          continue;
        }
        throw error;
      }
    }
    
    console.log(`Successfully copied all available data for match ${matchId} to user ${newUserId}`);
    
  } catch (error) {
    console.error('Error copying existing match data:', error);
    throw error;
  }
}

async function sendFilesToS3(startAt, sourceBucket, destinationBucket, streams, userId) {
  const fs = require('fs');
  for await (const stream of streams) {

    const { key } = stream;

    // Include user_id in the S3 key path for multi-tenant partitioning
    const s3Key = `${key}/user_id=${userId}/match_id=${startAt}_${key}.${stream.type}`;

    const putCommand = new PutObjectCommand({
      Bucket: destinationBucket,
      Key: s3Key,
      Body: fs.createReadStream(`/tmp/${key}.${stream.type}`),
      ContentType: `application/octet-stream`
    });
    await s3.send(putCommand);
  }
}

function parseWithSlippc(fileName, outputPath) {
  const slippcPath = '/opt/bin/slippc';  // Path to slippc binary in Lambda layer

  return new Promise((resolve, reject) => {
    execFile(
        slippcPath,
        [
          '-i', fileName,
          '-j', outputPath,
          '-a', outputPath + '/analysis.json',
          '-f',
        ],
        (error, stdout, stderr) => {
          if (error) {
            console.error('Error running slippc:', error);
            console.error('stderr:', stderr);
            return reject(new Error(`slippc failed: ${error.message}`));
          }

          if (stdout) console.log('slippc stdout:', stdout);
          if (stderr) console.log('slippc stderr:', stderr);

          resolve({
            stdout,  // usually empty if slippc only writes to files
            stderr,
            outputJsonPath: outputPath + 'output.json',
            analysisJsonPath: outputPath + 'analysis.json'
          });
        }
    );
  });
}

// Extract player-specific data from SLP file
async function extractPlayerData(slpFile, playerIndex, userId) {
  try {
    console.log(`Extracting player ${playerIndex} data for user ${userId}`);
    
    // Parse the SLP file to get player data
    const settings = JSON.parse((require('fs').readFileSync('/tmp/settings.json', 'utf-8')));
    const matchId = settings.match_id;
    
    // Read the parsed data files
    const framesData = JSON.parse((require('fs').readFileSync('/tmp/frames.json', 'utf-8')));
    const attacksData = JSON.parse((require('fs').readFileSync('/tmp/attacks.json', 'utf-8')));
    const punishesData = JSON.parse((require('fs').readFileSync('/tmp/punishes.json', 'utf-8')));
    
    // Extract data for the specific player
    const playerFrames = framesData.filter(frame => frame.player === playerIndex);
    const playerAttacks = attacksData.filter(attack => attack.player === playerIndex);
    const playerPunishes = punishesData.filter(punish => punish.player === playerIndex);
    
    // Create player-specific files
    const playerDataFiles = [
      {
        key: 'frames',
        type: 'parquet',
        data: playerFrames,
        filename: 'player_frames.parquet'
      },
      {
        key: 'attacks',
        type: 'parquet',
        data: playerAttacks,
        filename: 'player_attacks.parquet'
      },
      {
        key: 'punishes',
        type: 'parquet',
        data: playerPunishes,
        filename: 'player_punishes.parquet'
      }
    ];
    
    // Write player data files
    for (const file of playerDataFiles) {
      const filePath = `/tmp/${file.filename}`;
      
      // For now, we'll use the existing slippc output files
      // In a full implementation, you'd convert the filtered data to parquet
      const sourceFile = `/tmp/${file.key}.${file.type}`;
      if (require('fs').existsSync(sourceFile)) {
        require('fs').copyFileSync(sourceFile, filePath);
      }
    }
    
    return {
      matchId,
      playerIndex,
      userId,
      files: playerDataFiles
    };
    
  } catch (error) {
    console.error('Error extracting player data:', error);
    throw error;
  }
}

// Extract match-level data (shared across all players)
async function extractMatchData(slpFile) {
  try {
    console.log('Extracting match-level data');
    
    const settings = JSON.parse((require('fs').readFileSync('/tmp/settings.json', 'utf-8')));
    const matchId = settings.match_id;
    
    // Match-level files that should be duplicated for each user
    const matchDataFiles = [
      {
        key: 'match-settings',
        type: 'jsonl',
        filename: 'match_settings.jsonl'
      },
      {
        key: 'items',
        type: 'parquet',
        filename: 'match_items.parquet'
      }
    ];
    
    // Add platforms if it's Fountain of Dreams
    if (settings.stage === 2) {
      matchDataFiles.push({
        key: 'platforms',
        type: 'parquet',
        filename: 'match_platforms.parquet'
      });
    }
    
    return {
      matchId,
      files: matchDataFiles
    };
    
  } catch (error) {
    console.error('Error extracting match data:', error);
    throw error;
  }
}

// Store player-specific data
async function storePlayerData(playerData, userId) {
  try {
    console.log(`Storing player data for user ${userId}`);
    
    const { matchId, files } = playerData;
    
    for (const file of files) {
      const s3Key = `player-data/user_id=${userId}/match_id=${matchId}_${file.key}.${file.type}`;
      const filePath = `/tmp/${file.filename}`;
      
      if (require('fs').existsSync(filePath)) {
        const putCommand = new PutObjectCommand({
          Bucket: process.env.PROCESSED_DATA_BUCKET,
          Key: s3Key,
          Body: require('fs').createReadStream(filePath),
          ContentType: `application/octet-stream`
        });
        
        await s3.send(putCommand);
        console.log(`Stored player data: ${s3Key}`);
      }
    }
    
  } catch (error) {
    console.error('Error storing player data:', error);
    throw error;
  }
}

// Store match-level data (duplicated for each user)
async function storeMatchData(matchData, userId) {
  try {
    console.log(`Storing match data for user ${userId}`);
    
    const { matchId, files } = matchData;
    
    for (const file of files) {
      const s3Key = `match-data/user_id=${userId}/match_id=${matchId}_${file.key}.${file.type}`;
      const filePath = `/tmp/${file.filename}`;
      
      if (require('fs').existsSync(filePath)) {
        const putCommand = new PutObjectCommand({
          Bucket: process.env.PROCESSED_DATA_BUCKET,
          Key: s3Key,
          Body: require('fs').createReadStream(filePath),
          ContentType: `application/octet-stream`
        });
        
        await s3.send(putCommand);
        console.log(`Stored match data: ${s3Key}`);
      }
    }
    
  } catch (error) {
    console.error('Error storing match data:', error);
    throw error;
  }
}

exports.handler = async (event) => {
  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
  const fileName = path.basename(key);
  const tempPath = path.join('/tmp', fileName);

  // Extract user_id from S3 key path (first part of the path)
  const keyParts = key.split('/');
  if (keyParts.length < 2) {
    throw new Error('Invalid S3 key format. Expected: user_id/filename.slp or test/filename.slp');
  }
  
  // Handle test files (test/filename.slp) and user files (user_id/filename.slp)
  let userId;
  if (keyParts[0] === 'test') {
    // For test files, use 'test' as the user_id
    userId = 'test';
  } else {
    // For user files, use the first part as user_id
    userId = keyParts[0];
  }
  console.log('Processing SLP file for user_id:', userId);

  try {
    console.log('Retrieving SLP file from S3:', key);
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3.send(command);
    const buffer = await streamToBuffer(response.Body);

    console.log('Writing SLP file to /tmp');
    await fs.writeFile(tempPath, buffer);

  } catch (err) {
    console.log('Error retrieving SLP file from S3:', err);
    throw err;
  }

  // Parse SLP file to extract match information and player data
  let matchId;
  let playerIndex = 0; // Default to player 0 (P1)
  
  try {
    console.log('Parsing SLP file to extract match and player data');
    await parseWithSlippc(fileName, '/tmp');
    console.log('Slippc parsing completed');
    
    const settings = JSON.parse((require('fs').readFileSync('/tmp/settings.json', 'utf-8')));
    matchId = settings.match_id;
    console.log('Extracted match_id:', matchId);
    
    // Determine which player this user is in the match
    // For now, we'll assume the user is player 0 (P1)
    // In a full implementation, you'd determine this based on slippi_code or other logic
    playerIndex = 0;
    console.log('Assigned player index:', playerIndex);
    
  } catch (err) {
    console.log('Error parsing SLP file:', err);
    throw err;
  }

  try {
    console.log('Processing SLP file with per-player data extraction');
    
    // Extract player-specific data
    const playerData = await extractPlayerData(fileName, playerIndex, userId);
    console.log('Player data extracted successfully');
    
    // Extract match-level data
    const matchData = await extractMatchData(fileName);
    console.log('Match data extracted successfully');
    
    // Store player-specific data
    await storePlayerData(playerData, userId);
    console.log('Player data stored successfully');
    
    // Store match-level data (duplicated for this user)
    await storeMatchData(matchData, userId);
    console.log('Match data stored successfully');
    
    // Record the processing in deduplication table (for tracking purposes)
    await recordMatchProcessing(matchId, userId, 'completed');

  } catch (err) {
    console.log('Error processing SLP file:', err);
    
    // Record failed processing
    await recordMatchProcessing(matchId, userId, 'failed');
    throw err;
  }

  return {
    statusCode: 200,
    body: `SLP file processed successfully with per-player data extraction. User: ${userId}, Match: ${matchId}, Player: ${playerIndex}`
  };
};
