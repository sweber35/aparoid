# Aparoid Authentication Frontend

This is a minimal React-based authentication frontend for Aparoid, implementing AWS Cognito with Google OAuth integration.

## 🚀 Quick Start

### Prerequisites

1. **Deploy the Auth Stack** (from the root directory):
   ```bash
   ./scripts/deploy-cognito.sh
   ```

2. **Install Dependencies**:
   ```bash
   cd frontend
   npm install
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

The app will be available at `http://localhost:3000`

## 📁 File Structure

```
frontend/
├── src/
│   ├── components/auth/
│   │   ├── LoginPage.tsx          # Login form with Google OAuth
│   │   ├── SignupPage.tsx         # Signup form with validation
│   │   ├── ConfirmSignupPage.tsx  # Email confirmation
│   │   ├── Dashboard.tsx          # User dashboard
│   │   └── ProtectedRoute.tsx     # Route protection
│   ├── hooks/
│   │   └── useAuth.ts             # Authentication hook
│   ├── config/
│   │   └── auth.ts                # Cognito configuration
│   ├── App.tsx                    # Main app with routing
│   ├── main.tsx                   # React entry point
│   └── index.css                  # Tailwind CSS
├── package.json                   # Dependencies
├── vite.config.ts                 # Vite configuration
├── tailwind.config.js             # Tailwind configuration
└── tsconfig.json                  # TypeScript configuration
```

## 🔐 Authentication Features

### Login Options
- **Email/Password**: Traditional login with Cognito
- **Google OAuth**: Social login with Google account
- **Auto-redirect**: Seamless OAuth flow

### Signup Features
- **Email validation**: Password requirements and confirmation
- **Google signup**: One-click account creation
- **Email confirmation**: Required for email/password accounts

### User Management
- **Profile display**: Shows user information
- **Slippi code**: Custom attribute for Smash community
- **Subscription tier**: User plan management
- **Secure logout**: Proper session cleanup

## 🛠️ Configuration

### Environment Variables

The app uses environment variables from `frontend/.env` (created by deploy script):

```env
REACT_APP_USER_POOL_ID=your-user-pool-id
REACT_APP_USER_POOL_CLIENT_ID=your-client-id
REACT_APP_IDENTITY_POOL_ID=your-identity-pool-id
REACT_APP_AWS_REGION=us-east-1
REACT_APP_COGNITO_DOMAIN=aparoid.auth.us-east-1.amazoncognito.com
```

### Google OAuth Setup

1. **Google Cloud Console**:
   - Create OAuth 2.0 credentials
   - Add redirect URI: `https://[cognito-domain]/oauth2/idpresponse`

2. **Cognito Configuration**:
   - Add Google identity provider
   - Configure attribute mapping
   - Set up OAuth scopes

## 🎨 Styling

The app uses **Tailwind CSS** with:
- **Responsive design**: Mobile-first approach
- **Form styling**: Custom form components
- **Loading states**: Spinners and disabled states
- **Error handling**: User-friendly error messages

## 🔒 Security

### JWT Token Management
- **Automatic extraction**: From Authorization header
- **Token validation**: Cognito signature verification
- **User isolation**: Multi-tenant data separation

### Route Protection
- **Protected routes**: Require authentication
- **Redirect handling**: Save return URLs
- **Loading states**: Prevent flash of content

## 🧪 Testing

### Manual Testing
1. **Signup flow**: Test email/password and Google signup
2. **Login flow**: Test both authentication methods
3. **Route protection**: Verify redirects work
4. **User profile**: Check data display

### Development Testing
```bash
# Start development server
npm run dev

# Test authentication flows
# 1. Visit http://localhost:3000
# 2. Try signup with email/password
# 3. Try Google OAuth
# 4. Test protected routes
```

## 🚨 Troubleshooting

### Common Issues

1. **"Module not found" errors**:
   ```bash
   npm install
   ```

2. **Cognito configuration errors**:
   - Check environment variables
   - Verify Cognito setup in AWS Console

3. **Google OAuth errors**:
   - Verify redirect URIs in Google Console
   - Check Cognito identity provider configuration

4. **TypeScript errors**:
   - Install types: `npm install @types/react @types/react-dom`

### Debug Commands

```bash
# Check Cognito configuration
aws cognito-idp describe-user-pool --user-pool-id [pool-id]

# View user pool clients
aws cognito-idp list-user-pool-clients --user-pool-id [pool-id]

# Check identity pool
aws cognito-identity describe-identity-pool --identity-pool-id [pool-id]
```

## 📈 Next Steps

### Planned Enhancements
1. **User profile editing**: Update slippi code and preferences
2. **Password reset**: Forgot password functionality
3. **Multi-factor authentication**: SMS/email verification
4. **Subscription management**: Upgrade/downgrade plans
5. **Team features**: Shared workspaces

### Integration with Main App
1. **Replace SolidJS app**: Migrate existing Aparoid features
2. **API integration**: Connect to backend services
3. **Replay upload**: Integrate with S3 upload functionality
4. **Analytics dashboard**: User behavior insights

---

This authentication system provides a solid foundation for Aparoid's multi-tenant SaaS platform with secure, scalable user management. 