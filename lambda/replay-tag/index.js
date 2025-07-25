const { DynamoDBClient, PutItemCommand, GetItemCommand, DeleteItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');
const { jwt } = require('jsonwebtoken');

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });

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
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-User-ID',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
      },
      body: '',
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
    const { matchId, tag, action } = body;

    if (!matchId || !tag || !action) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-User-ID',
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
        },
        body: JSON.stringify({
          error: 'Missing required parameters: matchId, tag, action',
        }),
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