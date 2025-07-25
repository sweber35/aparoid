import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs';

export interface AuthStackProps extends cdk.StackProps {
  // Add any props needed for integration with other stacks
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly identityPool: cognito.CfnIdentityPool;
  public readonly userTable: dynamodb.Table;
  public readonly authenticatedRole: iam.Role;

  constructor(scope: Construct, id: string, props?: AuthStackProps) {
    super(scope, id, props);

    // Create DynamoDB table for user management
    this.userTable = new dynamodb.Table(this, 'aparoid-users-table', {
      tableName: 'aparoid-users',
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT for production
    });

    // Add GSI for email lookups
    this.userTable.addGlobalSecondaryIndex({
      indexName: 'email-index',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Create Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'aparoid-user-pool', {
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

    // Create User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(this, 'aparoid-client', {
      userPool: this.userPool,
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

    // Create User Pool Domain
    const userPoolDomain = new cognito.UserPoolDomain(this, 'aparoid-domain', {
      userPool: this.userPool,
      cognitoDomain: {
        domainPrefix: 'aparoid',
      },
    });

    // Create Pre-Signup Lambda Trigger
    const preSignupLogGroup = new logs.LogGroup(this, 'pre-signup-log-group', {
      logGroupName: '/aws/lambda/aparoid-pre-signup',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const preSignupLambda = new lambda.Function(this, 'pre-signup-lambda', {
      functionName: 'aparoid-pre-signup',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/cognito-triggers/pre-signup'),
      environment: {
        USER_TABLE: this.userTable.tableName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
      logGroup: preSignupLogGroup,
    });

    // Grant DynamoDB permissions to pre-signup Lambda
    this.userTable.grantWriteData(preSignupLambda);

    // Add pre-signup trigger to user pool
    this.userPool.addTrigger(
      cognito.UserPoolOperation.PRE_SIGN_UP,
      preSignupLambda
    );

    // Create Cognito Identity Pool
    this.identityPool = new cognito.CfnIdentityPool(this, 'aparoid-identity-pool', {
      identityPoolName: 'aparoid-identity-pool',
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: this.userPoolClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
          serverSideTokenCheck: false,
        },
      ],
    });

    // Create authenticated role for identity pool
    this.authenticatedRole = new iam.Role(this, 'cognito-authenticated-role', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    // Attach basic Lambda execution policy
    this.authenticatedRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
    );

    // Attach identity pool role attachment
    new cognito.CfnIdentityPoolRoleAttachment(this, 'identity-pool-role-attachment', {
      identityPoolId: this.identityPool.ref,
      roles: {
        authenticated: this.authenticatedRole.roleArn,
      },
    });

    // Output important values
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${this.stackName}-UserPoolId`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${this.stackName}-UserPoolClientId`,
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: this.identityPool.ref,
      description: 'Cognito Identity Pool ID',
      exportName: `${this.stackName}-IdentityPoolId`,
    });

    new cdk.CfnOutput(this, 'UserPoolDomain', {
      value: userPoolDomain.domainName,
      description: 'Cognito User Pool Domain',
      exportName: `${this.stackName}-UserPoolDomain`,
    });

    new cdk.CfnOutput(this, 'UserTableName', {
      value: this.userTable.tableName,
      description: 'User Management Table Name',
      exportName: `${this.stackName}-UserTableName`,
    });
  }
} 