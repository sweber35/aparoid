#!/bin/bash

# Deploy Cognito Authentication Stack for Aparoid
# This script deploys the auth stack and provides instructions for Google OAuth setup

set -e

echo "🚀 Deploying Aparoid Cognito Authentication Stack..."

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

# Deploy the auth stack
echo "📦 Deploying AuthStack..."
cdk deploy AuthStack --require-approval never

# Get the stack outputs
echo "📋 Getting stack outputs..."
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name AuthStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name AuthStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)
IDENTITY_POOL_ID=$(aws cloudformation describe-stacks --stack-name AuthStack --query 'Stacks[0].Outputs[?OutputKey==`IdentityPoolId`].OutputValue' --output text)
USER_POOL_DOMAIN=$(aws cloudformation describe-stacks --stack-name AuthStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolDomain`].OutputValue' --output text)
USER_TABLE_NAME=$(aws cloudformation describe-stacks --stack-name AuthStack --query 'Stacks[0].Outputs[?OutputKey==`UserTableName`].OutputValue' --output text)

echo "✅ AuthStack deployed successfully!"
echo ""
echo "📊 Stack Outputs:"
echo "  User Pool ID: $USER_POOL_ID"
echo "  User Pool Client ID: $USER_POOL_CLIENT_ID"
echo "  Identity Pool ID: $IDENTITY_POOL_ID"
echo "  User Pool Domain: $USER_POOL_DOMAIN"
echo "  User Table Name: $USER_TABLE_NAME"
echo ""

# Create .env file for frontend
echo "🔧 Creating frontend environment file..."
cat > frontend/.env << EOF
# Cognito Configuration
REACT_APP_USER_POOL_ID=$USER_POOL_ID
REACT_APP_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
REACT_APP_IDENTITY_POOL_ID=$IDENTITY_POOL_ID
REACT_APP_AWS_REGION=$(aws configure get region)
REACT_APP_COGNITO_DOMAIN=$USER_POOL_DOMAIN

# OAuth Redirect URLs
REACT_APP_REDIRECT_SIGN_IN=http://localhost:3000/auth/callback
REACT_APP_REDIRECT_SIGN_OUT=http://localhost:3000/auth/logout

# API Gateway URLs (will be updated after processing stack deployment)
REACT_APP_REPLAY_STUB_API=https://your-api-gateway-url.amazonaws.com/prod/replay-stub
REACT_APP_REPLAY_DATA_API=https://your-api-gateway-url.amazonaws.com/prod/replay-data
REACT_APP_REPLAY_TAG_API=https://your-api-gateway-url.amazonaws.com/prod/replay-tag
EOF

echo "✅ Created frontend/.env file"
echo ""

echo "🔐 Next Steps for Google OAuth Setup:"
echo ""
echo "1. Go to the AWS Console > Cognito > User Pools > $USER_POOL_ID"
echo "2. Navigate to 'Sign-in experience' > 'Federated identity provider sign-in'"
echo "3. Click 'Add identity provider' and select 'Google'"
echo "4. Configure Google OAuth:"
echo "   - Client ID: [Your Google OAuth Client ID]"
echo "   - Client Secret: [Your Google OAuth Client Secret]"
echo "   - Authorized scopes: email,profile,openid"
echo "5. Set up attribute mapping:"
echo "   - email -> email"
echo "   - given_name -> given_name"
echo "   - family_name -> family_name"
echo "6. Save the configuration"
echo ""
echo "🌐 Google OAuth Setup Instructions:"
echo "1. Go to https://console.developers.google.com/"
echo "2. Create a new project or select existing one"
echo "3. Enable Google+ API"
echo "4. Create OAuth 2.0 credentials"
echo "5. Add authorized redirect URIs:"
echo "   - https://$USER_POOL_DOMAIN/oauth2/idpresponse"
echo "6. Copy Client ID and Client Secret to Cognito"
echo ""
echo "📱 Frontend Integration:"
echo "1. Install AWS Amplify: npm install aws-amplify"
echo "2. Configure Amplify with the values in frontend/.env"
echo "3. Implement authentication flows in your React app"
echo ""
echo "🎯 Test the Setup:"
echo "1. Deploy the processing stack: cdk deploy ProcessingStack"
echo "2. Update API Gateway URLs in frontend/.env"
echo "3. Start the frontend: cd frontend && npm start"
echo "4. Test sign-up and sign-in flows"
echo ""

echo "✅ Cognito deployment complete!" 