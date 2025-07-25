# Aparoid Cognito Authentication Implementation Guide

This guide covers the complete implementation of AWS Cognito authentication with Google OAuth integration for Aparoid's multi-tenant SaaS platform.

## 🏗️ Architecture Overview

### Components
- **Cognito User Pool**: Manages user accounts and authentication
- **Cognito Identity Pool**: Provides temporary AWS credentials
- **Google OAuth**: External identity provider for social login
- **Pre-Signup Lambda**: Generates user IDs and stores user data
- **DynamoDB User Table**: Stores user profiles and metadata
- **JWT Authorization**: Secures API Gateway endpoints
- **Frontend Integration**: AWS Amplify for authentication flows

### Data Flow
1. User signs up/in via Google OAuth
2. Cognito creates user account with custom attributes
3. Pre-signup Lambda generates UUID and stores in DynamoDB
4. JWT token contains user_id for API authorization
5. Lambda functions extract user_id from JWT for data isolation

## 🚀 Deployment Steps

### 1. Deploy the Auth Stack

```bash
# Deploy the authentication infrastructure
./scripts/deploy-cognito.sh
```

This script will:
- Deploy the AuthStack with CDK
- Extract configuration values
- Create frontend environment file
- Provide Google OAuth setup instructions

### 2. Configure Google OAuth

#### Google Console Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `https://[your-cognito-domain]/oauth2/idpresponse`

#### Cognito Configuration
1. Go to AWS Console > Cognito > User Pools
2. Select your user pool
3. Navigate to "Sign-in experience" > "Federated identity provider sign-in"
4. Add Google identity provider
5. Configure attribute mapping:
   - `email` → `email`
   - `given_name` → `given_name`
   - `family_name` → `family_name`

### 3. Deploy Processing Stack

```bash
# Deploy the processing stack with JWT authorization
cdk deploy ProcessingStack
```

### 4. Update Frontend Configuration

Update the API Gateway URLs in `frontend/.env`:

```env
REACT_APP_REPLAY_STUB_API=https://[api-gateway-url]/prod/replay-stub
REACT_APP_REPLAY_DATA_API=https://[api-gateway-url]/prod/replay-data
REACT_APP_REPLAY_TAG_API=https://[api-gateway-url]/prod/replay-tag
```

## 🔧 Implementation Details

### Cognito User Pool Configuration

```typescript
// Custom attributes for user management
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
}
```

### Pre-Signup Lambda Trigger

```javascript
// Generates UUID and stores user data
const userId = `user_${uuidv4()}`;

const userItem = {
  user_id: { S: userId },
  email: { S: event.request.userAttributes.email },
  created_at: { S: new Date().toISOString() },
  auth_provider: { S: 'google' },
  subscription_tier: { S: 'free' },
  status: { S: 'active' },
};
```

### JWT Token Structure

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "custom:userId": "user_12345678-1234-1234-1234-123456789abc",
  "custom:slippiCode": "USER#ABC123",
  "custom:subscriptionTier": "free",
  "iss": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_xxx",
  "aud": "client-id",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### Lambda Function JWT Extraction

```javascript
function extractUserId(event) {
  // Extract from JWT token
  const authHeader = event.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyJWT(token);
    if (decoded && decoded['custom:userId']) {
      return decoded['custom:userId'];
    }
  }
  
  // Fallback to header extraction
  return event.headers['x-user-id'];
}
```

## 📱 Frontend Integration

### AWS Amplify Configuration

```javascript
import { Amplify } from 'aws-amplify';
import { authConfig } from './config/auth';

Amplify.configure({
  Auth: {
    region: authConfig.region,
    userPoolId: authConfig.userPoolId,
    userPoolWebClientId: authConfig.userPoolClientId,
    identityPoolId: authConfig.identityPoolId,
    oauth: authConfig.oauth,
  },
});
```

### Authentication Hooks

```javascript
import { useAuth } from './hooks/useAuth';

function App() {
  const { user, signIn, signOut, isLoading } = useAuth();
  
  if (isLoading) return <LoadingSpinner />;
  
  return user ? <Dashboard /> : <LoginPage />;
}
```

### API Calls with JWT

```javascript
import { Auth } from 'aws-amplify';

async function fetchReplayData(matchId) {
  const session = await Auth.currentSession();
  const token = session.getIdToken().getJwtToken();
  
  const response = await fetch('/api/replay-data', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ matchId }),
  });
  
  return response.json();
}
```

## 🔐 Security Considerations

### JWT Token Validation
- Verify token signature using Cognito public keys
- Check token expiration
- Validate issuer and audience claims
- Verify custom claims for user_id

### Data Isolation
- All S3 operations filtered by user_id
- Athena queries include user_id partition
- DynamoDB items scoped to user_id
- API Gateway authorizes all requests

### User Management
- UUID-based user identification
- Immutable user_id prevents data loss
- Slippi code as mutable attribute
- Subscription tier management

## 💰 Cost Considerations

### Cognito Pricing
- **User Pool**: $0.0055 per MAU (Monthly Active User)
- **Identity Pool**: $0.0055 per MAU
- **Federated Identities**: $0.0055 per MAU

### Lambda Triggers
- **Pre-Signup**: ~$0.0000002 per invocation
- **JWT Verification**: Minimal cost

### DynamoDB
- **User Table**: Pay-per-request pricing
- **GSI for email lookups**: Additional read/write units

## 📊 Monitoring and Analytics

### CloudWatch Metrics
- User sign-up/sign-in rates
- Authentication failures
- Lambda trigger performance
- API Gateway usage

### User Analytics
- Active user tracking
- Subscription tier distribution
- Slippi code usage patterns
- Feature adoption rates

## 🧪 Testing

### Local Development
```bash
# Start frontend with auth
cd frontend && npm start

# Test authentication flows
# 1. Sign up with Google
# 2. Verify user creation in DynamoDB
# 3. Test API calls with JWT
# 4. Verify data isolation
```

### Integration Testing
```javascript
// Test JWT extraction
const mockEvent = {
  headers: {
    authorization: 'Bearer valid-jwt-token'
  }
};
const userId = extractUserId(mockEvent);
expect(userId).toBe('user_12345678-1234-1234-1234-123456789abc');
```

## 🚨 Troubleshooting

### Common Issues

1. **JWT Token Expired**
   - Implement token refresh logic
   - Check token expiration in Lambda

2. **Google OAuth Errors**
   - Verify redirect URIs in Google Console
   - Check attribute mapping in Cognito

3. **User Data Not Created**
   - Check pre-signup Lambda logs
   - Verify DynamoDB permissions

4. **API Authorization Failures**
   - Verify JWT token format
   - Check API Gateway authorizer configuration

### Debug Commands

```bash
# Check user pool status
aws cognito-idp describe-user-pool --user-pool-id [pool-id]

# List users
aws cognito-idp list-users --user-pool-id [pool-id]

# Check Lambda logs
aws logs tail /aws/lambda/aparoid-pre-signup --follow

# Test API authorization
curl -H "Authorization: Bearer [jwt-token]" \
     -H "Content-Type: application/json" \
     -d '{"matchId":"test"}' \
     https://[api-url]/replay-data
```

## 📈 Next Steps

### Planned Enhancements
1. **Multi-Factor Authentication**: SMS/email verification
2. **Advanced User Profiles**: Avatar, preferences, settings
3. **Subscription Management**: Stripe integration
4. **Team Features**: Shared workspaces, collaboration
5. **Analytics Dashboard**: User behavior insights

### Production Considerations
1. **Custom Domain**: Set up custom Cognito domain
2. **Rate Limiting**: Implement API throttling
3. **Backup Strategy**: User data backup procedures
4. **Compliance**: GDPR, CCPA compliance measures
5. **Monitoring**: Enhanced logging and alerting

---

This implementation provides a robust, scalable authentication system for Aparoid's multi-tenant SaaS platform with Google OAuth integration, JWT-based API security, and comprehensive user management capabilities. 