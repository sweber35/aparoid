# Cognito Implementation Plan for Aparoid

## Overview

This document outlines the implementation of AWS Cognito for user authentication in Aparoid, including Google account integration. This will provide secure, scalable user management for the multi-tenant SaaS platform.

## Architecture Overview

### 1. Authentication Flow

```
User → Google OAuth → Cognito User Pool → JWT Token → API Gateway → Lambda Functions
```

### 2. Components

- **Cognito User Pool**: Manages user accounts and authentication
- **Cognito Identity Pool**: Provides temporary AWS credentials
- **Google OAuth**: External identity provider
- **API Gateway**: Validates JWT tokens
- **Lambda Functions**: Extract user_id from JWT claims

## Implementation Details

### 1. Cognito User Pool Configuration

#### User Pool Settings
```typescript
const userPool = new cognito.UserPool(this, 'aparoid-user-pool', {
  userPoolName: 'aparoid-users',
  selfSignUpEnabled: true,
  signInAliases: {
    email: true,
  },
  standardAttributes: {
    email: {
      required: true,
      mutable: true,
    },
    givenName: {
      required: false,
      mutable: true,
    },
    familyName: {
      required: false,
      mutable: true,
    },
  },
  customAttributes: {
    userId: new cognito.StringAttribute({
      mutable: false,
      minLen: 1,
      maxLen: 128,
    }),
    slippiCode: new cognito.StringAttribute({
      mutable: true,
      minLen: 0,
      maxLen: 20,
    }),
    subscriptionTier: new cognito.StringAttribute({
      mutable: true,
      minLen: 1,
      maxLen: 20,
    }),
  },
  passwordPolicy: {
    minLength: 8,
    requireLowercase: true,
    requireUppercase: true,
    requireDigits: true,
    requireSymbols: true,
  },
  accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
  removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT for production
});
```

#### User Pool Client
```typescript
const userPoolClient = new cognito.UserPoolClient(this, 'aparoid-client', {
  userPool,
  userPoolClientName: 'aparoid-web-client',
  generateSecret: false,
  authFlows: {
    adminUserPassword: true,
    userPassword: true,
    userSrp: true,
  },
  oAuth: {
    flows: {
      authorizationCodeGrant: true,
      implicitCodeGrant: true,
    },
    scopes: [
      cognito.OAuthScope.EMAIL,
      cognito.OAuthScope.OPENID,
      cognito.OAuthScope.PROFILE,
    ],
    callbackUrls: [
      'http://localhost:3000/auth/callback',
      'https://app.aparoid.com/auth/callback',
    ],
    logoutUrls: [
      'http://localhost:3000/auth/logout',
      'https://app.aparoid.com/auth/logout',
    ],
  },
});
```

### 2. Google OAuth Integration

#### Google OAuth Provider
```typescript
const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'google-provider', {
  userPool,
  clientId: 'your-google-client-id',
  clientSecret: 'your-google-client-secret',
  scopes: ['email', 'profile'],
  attributeRequestMethod: cognito.AttributeRequestMethod.GET,
  attributeMapping: {
    email: cognito.ProviderAttribute.GOOGLE_EMAIL,
    givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
    familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
    profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
  },
});
```

#### User Pool Domain
```typescript
const userPoolDomain = new cognito.UserPoolDomain(this, 'aparoid-domain', {
  userPool,
  cognitoDomain: {
    domainPrefix: 'aparoid',
  },
});
```

### 3. Cognito Identity Pool

#### Identity Pool Configuration
```typescript
const identityPool = new cognito.CfnIdentityPool(this, 'aparoid-identity-pool', {
  identityPoolName: 'aparoid-identity-pool',
  allowUnauthenticatedIdentities: false,
  cognitoIdentityProviders: [
    {
      clientId: userPoolClient.userPoolClientId,
      providerName: userPool.userPoolProviderName,
      serverSideTokenCheck: false,
    },
  ],
});
```

#### Authenticated Role
```typescript
const authenticatedRole = new iam.Role(this, 'cognito-authenticated-role', {
  assumedBy: new iam.FederatedPrincipal(
    'cognito-identity.amazonaws.com',
    {
      StringEquals: {
        'cognito-identity.amazonaws.com:aud': identityPool.ref,
      },
      'ForAnyValue:StringLike': {
        'cognito-identity.amazonaws.com:amr': 'authenticated',
      },
    },
    'sts:AssumeRoleWithWebIdentity'
  ),
});

// Attach the user access role to authenticated users
authenticatedRole.addManagedPolicy(
  iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
);

// Add custom policy for user-specific S3 access
authenticatedRole.addToPolicy(new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: [
    's3:GetObject',
    's3:PutObject',
    's3:DeleteObject',
    's3:ListBucket',
  ],
  resources: [
    storageStack.slpReplayBucket.bucketArn,
    `${storageStack.slpReplayBucket.bucketArn}/*`,
    storageStack.processedSlpDataBucket.bucketArn,
    `${storageStack.processedSlpDataBucket.bucketArn}/*`,
    storageStack.replayCacheBucket.bucketArn,
    `${storageStack.replayCacheBucket.bucketArn}/*`,
  ],
  conditions: {
    'StringEquals': {
      'aws:PrincipalTag/user_id': '${aws:PrincipalTag/user_id}',
    },
    'StringLike': {
      's3:prefix': '${aws:PrincipalTag/user_id}/*',
    },
  },
}));

new cognito.CfnIdentityPoolRoleAttachment(this, 'identity-pool-role-attachment', {
  identityPoolId: identityPool.ref,
  roles: {
    authenticated: authenticatedRole.roleArn,
  },
});
```

### 4. User Registration Flow

#### Pre-Signup Lambda Trigger
```typescript
const preSignupLambda = new lambda.Function(this, 'pre-signup-lambda', {
  functionName: 'aparoid-pre-signup',
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda/cognito-triggers/pre-signup'),
  environment: {
    USER_TABLE: userTable.tableName,
  },
});

userPool.addTrigger(
  cognito.UserPoolOperation.PRE_SIGN_UP,
  preSignupLambda
);
```

#### Pre-Signup Lambda Code
```javascript
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

    console.log('User created with ID:', userId);
    return event;

  } catch (error) {
    console.error('Error in pre-signup:', error);
    throw error;
  }
};
```

### 5. JWT Token Structure

#### Token Claims
```json
{
  "sub": "12345678-1234-1234-1234-123456789abc",
  "aud": "aparoid-web-client",
  "email_verified": true,
  "event_id": "12345678-1234-1234-1234-123456789abc",
  "token_use": "id",
  "auth_time": 1640995200,
  "iss": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_XXXXXXXXX",
  "cognito:username": "user_12345678-1234-1234-1234-123456789abc",
  "exp": 1640998800,
  "iat": 1640995200,
  "email": "user@example.com",
  "custom:userId": "user_12345678-1234-1234-1234-123456789abc",
  "custom:slippiCode": "USER#ABC123",
  "custom:subscriptionTier": "premium"
}
```

### 6. API Gateway Integration

#### JWT Authorizer
```typescript
const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'aparoid-authorizer', {
  cognitoUserPools: [userPool],
  authorizerName: 'aparoid-jwt-authorizer',
});

// Update API Gateway to use the authorizer
this.replayStubApi = new apigateway.RestApi(this, 'aparoid-replay-stub-api', {
  restApiName: 'aparoid-replay-stub-api',
  description: 'API Gateway for replay stub generation with JWT authentication',
  defaultAuthorizer: authorizer,
  defaultAuthorizationType: apigateway.AuthorizationType.COGNITO,
  defaultCorsPreflightOptions: {
    allowOrigins: apigateway.Cors.ALL_ORIGINS,
    allowMethods: apigateway.Cors.ALL_METHODS,
    allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
  },
});
```

### 7. Lambda Function Updates

#### Extract User ID from JWT
```javascript
// Helper function to extract user_id from JWT claims
function extractUserIdFromJWT(event) {
  // Get user_id from JWT claims
  const claims = event.requestContext.authorizer.claims;
  const userId = claims['custom:userId'];
  
  if (!userId) {
    throw new Error('User ID not found in JWT claims');
  }
  
  return userId;
}

// Updated Lambda handler
exports.handler = async (event) => {
  try {
    // Extract user_id from JWT instead of headers
    const userId = extractUserIdFromJWT(event);
    
    // Rest of the function remains the same
    const { queryType, actions, comboType, matchId } = JSON.parse(event.body);
    
    // ... existing logic ...
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
      },
    };
  }
};
```

### 8. Frontend Integration

#### Authentication Flow
```javascript
// Initialize Amplify
import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_XXXXXXXXX',
    userPoolWebClientId: 'your-client-id',
    oauth: {
      domain: 'aparoid.auth.us-east-1.amazoncognito.com',
      scope: ['email', 'openid', 'profile'],
      redirectSignIn: 'http://localhost:3000/auth/callback',
      redirectSignOut: 'http://localhost:3000/auth/logout',
      responseType: 'code',
    },
  },
});

// Google Sign-In
import { Auth } from 'aws-amplify';

async function signInWithGoogle() {
  try {
    const user = await Auth.federatedSignIn({
      provider: 'Google'
    });
    console.log('Signed in user:', user);
  } catch (error) {
    console.error('Error signing in:', error);
  }
}

// Get JWT Token
async function getAuthToken() {
  try {
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    return token;
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
}

// API Request with JWT
async function makeAuthenticatedRequest(endpoint, data) {
  const token = await getAuthToken();
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  
  return response.json();
}
```

### 9. User Management

#### User Table Schema
```typescript
const userTable = new dynamodb.Table(this, 'aparoid-users-table', {
  tableName: 'aparoid-users',
  partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT for production
  
  // GSI for email lookups
  globalSecondaryIndexes: [
    {
      indexName: 'email-index',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    },
  ],
});
```

#### User Profile Management
```javascript
// Update user profile
async function updateUserProfile(userId, updates) {
  const command = new UpdateItemCommand({
    TableName: process.env.USER_TABLE,
    Key: { user_id: { S: userId } },
    UpdateExpression: 'SET #slippiCode = :slippiCode, #tier = :tier',
    ExpressionAttributeNames: {
      '#slippiCode': 'slippi_code',
      '#tier': 'subscription_tier',
    },
    ExpressionAttributeValues: {
      ':slippiCode': { S: updates.slippiCode },
      ':tier': { S: updates.subscriptionTier },
    },
  });
  
  await dynamo.send(command);
}
```

### 10. Security Considerations

#### Token Validation
- JWT tokens are automatically validated by API Gateway
- Tokens expire after 1 hour (configurable)
- Refresh tokens handled by Cognito
- Custom claims validated in Lambda functions

#### Data Access Control
- All S3 access controlled by IAM policies
- User-specific data isolation enforced at infrastructure level
- No cross-user data access possible

#### Rate Limiting
```typescript
// Add rate limiting to API Gateway
const usagePlan = new apigateway.UsagePlan(this, 'aparoid-usage-plan', {
  name: 'aparoid-usage-plan',
  throttle: {
    rateLimit: 1000,
    burstLimit: 2000,
  },
  quota: {
    limit: 100000,
    period: apigateway.Period.MONTH,
  },
});

usagePlan.addApiStage({
  stage: this.replayStubApi.deploymentStage,
});
```

## Deployment Steps

### 1. Google OAuth Setup
1. Create Google Cloud Project
2. Enable Google+ API
3. Create OAuth 2.0 credentials
4. Configure authorized redirect URIs
5. Note Client ID and Client Secret

### 2. Cognito Configuration
1. Deploy CDK stack with Cognito resources
2. Configure Google OAuth provider
3. Set up custom attributes
4. Configure user pool triggers

### 3. Frontend Integration
1. Install AWS Amplify
2. Configure authentication
3. Implement sign-in/sign-out flows
4. Add JWT token handling

### 4. API Updates
1. Update Lambda functions to extract user_id from JWT
2. Remove X-User-ID header requirements
3. Test authentication flow
4. Update documentation

## Benefits

### 1. Security
- **JWT-based authentication**: Secure, stateless authentication
- **Google OAuth integration**: Trusted third-party authentication
- **Automatic token validation**: No manual token verification needed
- **Fine-grained access control**: IAM policies enforce data isolation

### 2. Scalability
- **Managed service**: AWS handles user management scaling
- **Global availability**: Cognito available in all AWS regions
- **High availability**: 99.9% uptime SLA
- **Auto-scaling**: Handles traffic spikes automatically

### 3. User Experience
- **Single sign-on**: Google account integration
- **Seamless authentication**: No password management
- **Social login**: Familiar authentication flow
- **Profile management**: User can update preferences

### 4. Developer Experience
- **AWS Amplify**: Easy frontend integration
- **SDK support**: Multiple language support
- **Built-in security**: No custom security implementation needed
- **Monitoring**: CloudWatch integration for analytics

## Cost Considerations

### 1. Cognito Pricing
- **User Pool**: $0.0055 per MAU (Monthly Active User)
- **Identity Pool**: $0.0055 per MAU
- **Storage**: $0.25 per GB per month
- **Data transfer**: Standard AWS data transfer rates

### 2. Optimization
- **MAU tracking**: Monitor active user counts
- **Storage optimization**: Clean up unused user data
- **Caching**: Cache user profiles to reduce lookups

## Monitoring and Analytics

### 1. CloudWatch Metrics
- User sign-up/sign-in rates
- Authentication failures
- Token usage patterns
- API request patterns

### 2. User Analytics
- User engagement metrics
- Feature usage tracking
- Subscription tier distribution
- Geographic distribution

This Cognito implementation provides a complete, secure, and scalable authentication solution for Aparoid's multi-tenant SaaS platform. 