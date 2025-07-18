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

const { generateSequenceQuery } = require('./util.js');
  
const dynamo = new DynamoDBClient({ region: process.env.REGION });
const athena = new AthenaClient({ region: process.env.REGION });
const s3 = new S3Client({ region: process.env.REGION });

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
      const { actions, matchId } = JSON.parse(event.body);
      console.log('actions:', actions);

      let results;

      const query = generateSequenceQuery(actions, 120);
      console.log('query:', query);

    //   const ledgedashStubsQuery = `
    //     SELECT
    //     lds.match_id AS matchId,
    //     CASE 
    //         WHEN lds.sequence_start - 120 < 0 THEN 0
    //         ELSE lds.sequence_start - 120
    //     END AS frameStart,
    //     lds.sequence_end + 120 AS frameEnd,
    //     ms.stage AS stageId,
    //     ARRAY_AGG(
    //         ROW(ps.player_tag, ps.ext_char)
    //     ) AS players
    //     FROM ledge_dash_summary lds
    //     JOIN match_settings ms
    //     ON lds.match_id = ms.match_id
    //     JOIN player_settings ps
    //     ON lds.match_id = ps.match_id
    //     GROUP BY
    //     lds.match_id,
    //     ms.stage,
    //     CASE 
    //         WHEN lds.sequence_start - 120 < 0 THEN 0
    //         ELSE lds.sequence_start - 120
    //     END,
    //     lds.sequence_end + 120
    //     ${matchId ? `WHERE matchId = ${matchId}` : ''}
    //   `;

    // const shineGrabStubsQuery = `
    //     SELECT
    //     sgs.match_id AS matchId,
    //     CASE 
    //         WHEN sgs.sequence_start - 120 < 0 THEN 0
    //         ELSE sgs.sequence_start - 120
    //     END AS frameStart,
    //     sgs.sequence_end + 120 AS frameEnd,
    //     ms.stage AS stageId,
    //     ARRAY_AGG(
    //         ROW(ps.player_tag, ps.ext_char)
    //     ) AS players
    //     FROM shine_grabs sgs
    //     JOIN match_settings ms
    //     ON sgs.match_id = ms.match_id
    //     JOIN player_settings ps
    //     ON sgs.match_id = ps.match_id
    //     GROUP BY
    //     sgs.match_id,
    //     ms.stage,
    //     CASE 
    //         WHEN sgs.sequence_start - 120 < 0 THEN 0
    //         ELSE sgs.sequence_start - 120
    //     END,
    //     sgs.sequence_end + 120
    //     ${matchId ? `WHERE matchId = ${matchId}` : ''}
    // `;

      results = await runAthenaQuery(query);

      const enrichedResults = await Promise.all(
        results.map(async (r) => {
          const bugged = await getBuggedTag(r.matchId, r.frameStart, r.frameEnd);
          return { ...r, bugged };
        })
      );

      console.log(enrichedResults);

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