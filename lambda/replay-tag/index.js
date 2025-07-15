const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { setTag } = require('./util.js');

const db = new DynamoDBClient({ region: process.env.REGION });

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
    const { matchId, frameStart, frameEnd, bugged } = JSON.parse(event.body);

    if ( !matchId || !frameStart || !frameEnd || bugged === undefined) {
      return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing required parameter: { matchId, frameStart, frameEnd, bugged }' }),
      };
    }

    const result = await setTag(matchId, frameStart, frameEnd, 'bugged', bugged);

    return {
      statusCode: 200,
      body: JSON.stringify({ bugged: result }),
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