// Cognito Authentication Configuration
export const authConfig = {
  // These values will be replaced during deployment
  userPoolId: process.env.REACT_APP_USER_POOL_ID || 'your-user-pool-id',
  userPoolClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID || 'your-client-id',
  identityPoolId: process.env.REACT_APP_IDENTITY_POOL_ID || 'your-identity-pool-id',
  region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
  
  // OAuth configuration
  oauth: {
    domain: process.env.REACT_APP_COGNITO_DOMAIN || 'aparoid.auth.us-east-1.amazoncognito.com',
    scope: ['email', 'openid', 'profile'],
    redirectSignIn: process.env.REACT_APP_REDIRECT_SIGN_IN || 'http://localhost:3000/auth/callback',
    redirectSignOut: process.env.REACT_APP_REDIRECT_SIGN_OUT || 'http://localhost:3000/auth/logout',
    responseType: 'code',
  },
};

// API Gateway endpoints
export const apiConfig = {
  replayStubApi: process.env.REACT_APP_REPLAY_STUB_API || 'https://your-api-gateway-url.amazonaws.com/prod/replay-stub',
  replayDataApi: process.env.REACT_APP_REPLAY_DATA_API || 'https://your-api-gateway-url.amazonaws.com/prod/replay-data',
  replayTagApi: process.env.REACT_APP_REPLAY_TAG_API || 'https://your-api-gateway-url.amazonaws.com/prod/replay-tag',
};

// User profile configuration
export const userProfileConfig = {
  // Default subscription tiers
  subscriptionTiers: {
    free: {
      name: 'Free',
      maxReplays: 100,
      maxStorageGB: 1,
      features: ['Basic replay analysis', 'Community features'],
    },
    pro: {
      name: 'Pro',
      maxReplays: 1000,
      maxStorageGB: 10,
      features: ['Advanced analytics', 'Custom tags', 'Export data'],
    },
    premium: {
      name: 'Premium',
      maxReplays: -1, // Unlimited
      maxStorageGB: 100,
      features: ['All Pro features', 'Priority support', 'API access'],
    },
  },
}; 