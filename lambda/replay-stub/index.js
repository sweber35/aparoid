const {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
} = require('@aws-sdk/client-athena');

const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand
} = require('@aws-sdk/client-s3');

const {
  DynamoDBClient,
  GetItemCommand
} = require('@aws-sdk/client-dynamodb');

const { generateSequenceQuery, generateComboQuery } = require('./util.js');
const { jwt } = require('jsonwebtoken');

const dynamo = new DynamoDBClient({ region: process.env.REGION });
const athena = new AthenaClient({ region: process.env.REGION });
const s3 = new S3Client({ region: process.env.REGION });
const CACHE_BUCKET = process.env.CACHE_BUCKET || 'aparoid-replay-cache';

function getStubCacheKey(queryType, queryParams, matchId, userId) {
    if (queryType === 'sequence') {
        const { actions } = queryParams;
        const actionsHash = JSON.stringify(actions).replace(/[^a-zA-Z0-9]/g, '');
        const cacheKey = `stubs/sequence/${userId}/${actionsHash}-${matchId || 'all'}.json`;
        return cacheKey;
    } else if (queryType === 'combo') {
        const { comboType } = queryParams;
        const cacheKey = `stubs/combo/${userId}/${comboType}-${matchId || 'all'}.json`;
        return cacheKey;
    }
    throw new Error(`Unknown query type: ${queryType}`);
}

async function tryGetCachedStubs(key) {
    try {
        const obj = await s3.send(new GetObjectCommand({
            Bucket: CACHE_BUCKET,
            Key: key
        }));
        const body = await obj.Body.transformToString();
        return JSON.parse(body);
    } catch (err) {
        if (err.name !== 'NoSuchKey') console.error('Cache miss error:', err);
        return null;
    }
}

async function cacheStubsJson(key, payload) {
    await s3.send(new PutObjectCommand({
        Bucket: CACHE_BUCKET,
        Key: key,
        Body: JSON.stringify(payload),
        ContentType: 'application/json'
    }));
}

async function getBuggedTag(matchId, frameStart, frameEnd) {
    const key = {
      PK: { S: `replay#${matchId}` },
      SK: { S: `stub#${frameStart}#${frameEnd}` }
    };
  
    try {
      const res = await dynamo.send(new GetItemCommand({
        TableName: process.env.TAG_TABLE_NAME,
        Key: key,
        ProjectionExpression: "tag_bugged"
      }));
  
      return res.Item?.tag_bugged?.BOOL || false;
    } catch (err) {
      console.warn("DynamoDB error for", matchId, frameStart, frameEnd, err.message);
      return false;
    }
}

async function runAthenaQuery(query) {

  const startCommand = new StartQueryExecutionCommand({
      QueryString: query,
      QueryExecutionContext: { Database: process.env.GLUE_DATABASE },
      ResultConfiguration: { OutputLocation: process.env.QUERY_OUTPUT_LOCATION },
      ResultReuseConfiguration: {
          ResultReuseByAgeConfiguration: {
              Enabled: true,
              MaxAgeInMinutes: 60, // Adjust as needed (max is 43200 = 30 days)
          }
      }
  });

  const start = await athena.send(startCommand);

  const queryExecutionId = start.QueryExecutionId;
  if (!queryExecutionId) throw new Error('Query start failed');

  // Wait for query completion
  let state = 'QUEUED';
  while (state === 'QUEUED' || state === 'RUNNING') {
      await new Promise((res) => setTimeout(res, 1000));
      const status = await athena.send(new GetQueryExecutionCommand({
          QueryExecutionId: queryExecutionId,
      }));
      state = status.QueryExecution?.Status?.State ?? 'FAILED';

      if (state === 'FAILED') {
          throw new Error(`Query failed: ${status.QueryExecution?.Status?.StateChangeReason}`);
      }
  }

  // Single result for small queries
  const result = await athena.send(new GetQueryResultsCommand({
      QueryExecutionId: queryExecutionId,
  }));

  console.log('Raw Athena result:', JSON.stringify(result, null, 2));

  const rows = result.ResultSet?.Rows || [];
  const headers = rows[0]?.Data?.map(d => d.VarCharValue || '') || [];

  console.log('Headers:', headers);
  console.log('Rows count:', rows.length);
  console.log('Rows:', rows);

  const parsedResults = rows.slice(1).map(row =>
      row.Data?.reduce((obj, val, idx) => {
          obj[headers[idx]] = val?.VarCharValue || '';
          return obj;
      }, {})
  );

  console.log('Parsed results:', parsedResults);
  return parsedResults;
}

// JWT verification function
function verifyJWT(token) {
  try {
    // For Cognito JWTs, we need to verify against the user pool
    // This is a simplified version - in production, you'd verify the signature
    const decoded = jwt.decode(token);
    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

// Extract user_id from JWT token or headers
function extractUserId(event) {
  // First try to extract from JWT token
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyJWT(token);
    if (decoded && decoded['custom:userId']) {
      console.log('Extracted user_id from JWT:', decoded['custom:userId']);
      return decoded['custom:userId'];
    }
  }

  // Fallback to header extraction (for backward compatibility)
  const headers = event.headers || {};
  const userId = headers['x-user-id'] || headers['X-User-ID'];
  if (userId) {
    console.log('Extracted user_id from header:', userId);
    return userId;
  }

  // Try to extract from body
  try {
    const body = JSON.parse(event.body || '{}');
    const bodyUserId = body.user_id || body.userId || '';
    if (bodyUserId) {
      console.log('Extracted user_id from body:', bodyUserId);
      return bodyUserId;
    }
  } catch (err) {
    console.warn('Could not parse request body for user_id');
  }

  console.error('No user_id found in request');
  return null;
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  if (event.requestContext?.http?.method === 'OPTIONS') {
      return {
          statusCode: 204,
          headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type,X-User-ID',
              'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
          },
      };
  }

  try {
    // Extract user_id from JWT or headers
    const userId = extractUserId(event);
    if (!userId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-User-ID',
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
        },
        body: JSON.stringify({
          error: 'Missing user_id. Please provide user_id in Authorization header (JWT) or X-User-ID header.',
        }),
      };
    }

    console.log('Processing request for user_id:', userId);

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { actionDefs, bufferFrames, queryType } = body;

    if (!actionDefs || !bufferFrames || !queryType) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-User-ID',
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
        },
        body: JSON.stringify({
          error: 'Missing required parameters: actionDefs, bufferFrames, queryType',
        }),
      };
    }

      // Determine query parameters based on query type
      let queryParams;
      if (queryType === 'sequence') {
          queryParams = { actions: actionDefs };
      } else if (queryType === 'combo') {
          queryParams = { comboType: queryType }; // Assuming queryType itself is the comboType for now
      } else {
          throw new Error(`Unknown query type: ${queryType}`);
      }

      // Check cache first
      const cacheKey = getStubCacheKey(queryType, queryParams, null, userId); // matchId is not in body for sequence, so pass null
      const cachedResults = await tryGetCachedStubs(cacheKey);
      
      if (cachedResults) {
          console.log('Returning cached results, starting background refresh');
          
          // Start background refresh of cached results
          (async () => {
              try {
                  console.log('Starting background query execution for cache refresh');
                  let query;
                  if (queryType === 'sequence') {
                      query = generateSequenceQuery(actionDefs, bufferFrames, userId);
                  } else if (queryType === 'combo') {
                      query = generateComboQuery(queryType, null, userId); // matchId is not in body for combo
                  }
                  
                  const results = await runAthenaQuery(query);
                  
                  const enrichedResults = await Promise.all(
                      results.map(async (r) => {
                          const bugged = await getBuggedTag(r.matchId, r.frameStart, r.frameEnd);
                          return { ...r, bugged };
                      })
                  );

                  console.log('Background query completed, updating cache');
                  await cacheStubsJson(cacheKey, enrichedResults);
                  console.log('Cache updated successfully');
              } catch (error) {
                  console.error('Background query failed:', error);
              }
          })();

          return {
              statusCode: 200,
              body: JSON.stringify(cachedResults),
              headers: {
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Headers': 'Content-Type,X-User-ID',
                  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
              }
          };
      }

      // If no cache, run the query and wait for results
      console.log('No cache found, running fresh query');
      
      let query;
      if (queryType === 'sequence') {
          query = generateSequenceQuery(actionDefs, bufferFrames, userId);
      } else if (queryType === 'combo') {
          query = generateComboQuery(queryType, null, userId); // matchId is not in body for combo
      }
      
      console.log('query:', query);
      
      // Run the query and wait for results
      const results = await runAthenaQuery(query);
      
      const enrichedResults = await Promise.all(
          results.map(async (r) => {
              const bugged = await getBuggedTag(r.matchId, r.frameStart, r.frameEnd);
              return { ...r, bugged };
          })
      );

      // Cache the results for future requests
      console.log('Query completed, caching results');
      await cacheStubsJson(cacheKey, enrichedResults);
      console.log('Results cached successfully');

      return {
          statusCode: 200,
          body: JSON.stringify(enrichedResults),
          headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type,X-User-ID',
              'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
          }
      };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal error' }),
      headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-User-ID',
          'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
      }
    };
  }
}; 