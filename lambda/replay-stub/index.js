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
  
const dynamo = new DynamoDBClient({ region: process.env.REGION });
const athena = new AthenaClient({ region: process.env.REGION });
const s3 = new S3Client({ region: process.env.REGION });
const CACHE_BUCKET = process.env.CACHE_BUCKET || 'aparoid-replay-cache';

function getStubCacheKey(queryType, queryParams, matchId) {
    if (queryType === 'sequence') {
        const { actions } = queryParams;
        const actionsHash = JSON.stringify(actions).replace(/[^a-zA-Z0-9]/g, '');
        return `stubs/sequence/${actionsHash}-${matchId || 'all'}.json`;
    } else if (queryType === 'combo') {
        const { comboType } = queryParams;
        return `stubs/combo/${comboType}-${matchId || 'all'}.json`;
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

  const result = await athena.send(new GetQueryResultsCommand({
      QueryExecutionId: queryExecutionId,
  }));

  const rows = result.ResultSet?.Rows || [];
  const headers = rows[0]?.Data?.map(d => d.VarCharValue || '') || [];

  return rows.slice(1).map(row =>
      row.Data?.reduce((obj, val, idx) => {
          obj[headers[idx]] = val?.VarCharValue || '';
          return obj;
      }, {})
  );
}

exports.handler = async (event) => {

  if (event.requestContext?.http?.method === 'OPTIONS') {
      return {
          statusCode: 204,
          headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
          },
      };
  }

  try {
      const { queryType, actions, comboType, matchId } = JSON.parse(event.body);
      console.log('queryType:', queryType);
      console.log('actions:', actions);
      console.log('comboType:', comboType);

      // Determine query parameters based on query type
      let queryParams;
      if (queryType === 'sequence') {
          queryParams = { actions };
      } else if (queryType === 'combo') {
          queryParams = { comboType };
      } else {
          throw new Error(`Unknown query type: ${queryType}`);
      }

      // Check cache first
      const cacheKey = getStubCacheKey(queryType, queryParams, matchId);
      const cachedResults = await tryGetCachedStubs(cacheKey);
      
      if (cachedResults) {
          console.log('Returning cached results, starting background refresh');
          
          // Start background refresh of cached results
          (async () => {
              try {
                  console.log('Starting background query execution for cache refresh');
                  let query;
                  if (queryType === 'sequence') {
                      query = generateSequenceQuery(actions, 120);
                  } else if (queryType === 'combo') {
                      query = generateComboQuery(comboType, matchId);
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
                  'Access-Control-Allow-Headers': 'Content-Type',
                  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
              }
          };
      }

      // If no cache, run the query and wait for results
      console.log('No cache found, running fresh query');
      
      let query;
      if (queryType === 'sequence') {
          query = generateSequenceQuery(actions, 120);
      } else if (queryType === 'combo') {
          query = generateComboQuery(comboType, matchId);
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
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
          }
      };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
      headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
      }
    };
  }
}; 