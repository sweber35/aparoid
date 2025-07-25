const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { v4: uuidv4 } = require('uuid');

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  console.log('Pre-signup event:', JSON.stringify(event, null, 2));

  try {
    // Generate a unique user_id
    const userId = `user_${uuidv4()}`;
    
    // Store user information in DynamoDB
    const userItem = {
      user_id: { S: userId },
      email: { S: event.request.userAttributes.email },
      created_at: { S: new Date().toISOString() },
      auth_provider: { S: event.userName.includes('Google_') ? 'google' : 'cognito' },
      subscription_tier: { S: 'free' },
      status: { S: 'active' },
    };

    if (event.request.userAttributes.given_name) {
      userItem.given_name = { S: event.request.userAttributes.given_name };
    }
    if (event.request.userAttributes.family_name) {
      userItem.family_name = { S: event.request.userAttributes.family_name };
    }

    await dynamo.send(new PutItemCommand({
      TableName: process.env.USER_TABLE,
      Item: userItem,
    }));

    // Set the user_id as a custom attribute
    event.response.autoConfirmUser = true;
    event.response.autoVerifyEmail = true;
    event.response.autoVerifyPhone = false;

    // Add custom attributes to the user
    event.request.userAttributes['custom:userId'] = userId;
    event.request.userAttributes['custom:slippiCode'] = '';
    event.request.userAttributes['custom:subscriptionTier'] = 'free';

    console.log('User created with ID:', userId);
    return event;

  } catch (error) {
    console.error('Error in pre-signup:', error);
    throw error;
  }
}; 