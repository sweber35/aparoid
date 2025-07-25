import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';

export interface ProcessingStackProps extends cdk.StackProps {
  slpReplayBucketName: string;
  processedDataBucketName: string;
  replayCacheBucketName: string;
  tagTableName: string;
  matchDeduplicationTableName: string; // Add deduplication table name
  glueDatabaseName: string;
  athenaOutputLocation: string;
  userAccessRoleArn?: string; // Optional: ARN of user access role for multi-tenancy
  userPool?: cognito.UserPool; // Optional: Cognito User Pool for JWT authorization
}

export class ProcessingStack extends cdk.Stack {
  public readonly slpToParquetLambda: lambda.Function;
  public readonly replayStubLambda: lambda.Function;
  public readonly replayDataLambda: lambda.Function;
  public readonly replayTagLambda: lambda.Function;
  public readonly replayStubApi: apigateway.RestApi;
  public readonly replayDataApi: apigateway.RestApi;
  public readonly replayTagApi: apigateway.RestApi;
  public readonly s3EventNotification: s3n.LambdaDestination;

  constructor(scope: Construct, id: string, props: ProcessingStackProps) {
    super(scope, id, props);

    // Import the S3 buckets from the StorageStack
    const slpReplayBucket = s3.Bucket.fromBucketName(
      this,
      'aparoid-slp-replays-bucket',
      props.slpReplayBucketName
    );

    const processedSlpDataBucket = s3.Bucket.fromBucketName(
      this,
      'aparoid-processed-data-bucket',
      props.processedDataBucketName
    );

    // Import the DynamoDB table from StorageStack
    const tagTable = dynamodb.Table.fromTableName(
      this,
      'aparoid-replay-tags-table',
      props.tagTableName
    );

    // Import the cache bucket from StorageStack
    const replayCacheBucket = s3.Bucket.fromBucketName(
      this,
      'aparoid-replay-cache-bucket',
      props.replayCacheBucketName
    );

    // Import user access role if provided
    const userAccessRole = props.userAccessRoleArn 
      ? iam.Role.fromRoleArn(this, 'aparoid-user-access-role', props.userAccessRoleArn)
      : undefined;

    // Slippc Lambda layer
    const slippcLayer = new lambda.LayerVersion(this, 'aparoid-slippc-layer', {
      layerVersionName: `aparoid-slippc-layer`,
      code: lambda.Code.fromAsset('lambda-layers/slippc-layer'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'Layer containing slippc binary for SLP file parsing',
    });

    // Create explicit CloudWatch log group for the SLP to Parquet Lambda function
    const slpToParquetLogGroup = new logs.LogGroup(this, 'aparoid-slp-to-parquet-logs', {
      logGroupName: `/aws/lambda/aparoid-slp-to-parquet`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_WEEK,
    });

    // Create explicit CloudWatch log group for the Replay Stub Lambda function
    const replayStubLogGroup = new logs.LogGroup(this, 'aparoid-replay-stub-logs', {
      logGroupName: `/aws/lambda/aparoid-replay-stub`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_WEEK,
    });

    // Create explicit CloudWatch log group for the Replay Data Lambda function
    const replayDataLogGroup = new logs.LogGroup(this, 'aparoid-replay-data-logs', {
      logGroupName: `/aws/lambda/aparoid-replay-data`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_WEEK,
    });

    // Create explicit CloudWatch log group for the Replay Tag Lambda function
    const replayTagLogGroup = new logs.LogGroup(this, 'aparoid-replay-tag-logs', {
      logGroupName: `/aws/lambda/aparoid-replay-tag`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_WEEK,
    });

    // SLP to Parquet Lambda
    this.slpToParquetLambda = new lambda.Function(this, 'aparoid-slp-to-parquet-lambda', {
      functionName: 'aparoid-slp-to-parquet',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/slp-to-parquet'),
      layers: [slippcLayer], // Add slippc layer back
      environment: {
        PROCESSED_DATA_BUCKET: props.processedDataBucketName,
        DEPLOYMENT_REGION: this.region,
        MATCH_DEDUPLICATION_TABLE: props.matchDeduplicationTableName, // Add deduplication table
      },
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      logGroup: slpToParquetLogGroup,
    });

    // Replay Stub Lambda function
    this.replayStubLambda = new lambda.Function(this, 'aparoid-replay-stub-lambda', {
      functionName: `aparoid-replay-stub`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/replay-stub'),
      environment: {
        REGION: this.region,
        TAG_TABLE_NAME: props.tagTableName,
        GLUE_DATABASE: props.glueDatabaseName,
        QUERY_OUTPUT_LOCATION: props.athenaOutputLocation,
        CACHE_BUCKET: props.replayCacheBucketName,
      },
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      logGroup: replayStubLogGroup, // Use the explicit log group
    });

    // Replay Data Lambda function
    this.replayDataLambda = new lambda.Function(this, 'aparoid-replay-data-lambda', {
      functionName: `aparoid-replay-data`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/replay-data'),
      environment: {
        REGION: this.region,
        GLUE_DATABASE: props.glueDatabaseName,
        QUERY_OUTPUT_LOCATION: props.athenaOutputLocation,
        CACHE_BUCKET: props.replayCacheBucketName,
      },
      timeout: cdk.Duration.minutes(10),
      memorySize: 1024,
      logGroup: replayDataLogGroup, // Use the explicit log group
    });

    // Replay Tag Lambda function
    this.replayTagLambda = new lambda.Function(this, 'aparoid-replay-tag-lambda', {
      functionName: `aparoid-replay-tag`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/replay-tag'),
      environment: {
        REGION: this.region,
        TAG_TABLE_NAME: props.tagTableName,
      },
      timeout: cdk.Duration.minutes(1),
      memorySize: 256,
      logGroup: replayTagLogGroup, // Use the explicit log group
    });

    // Create JWT authorizer if userPool is provided
    let authorizer: apigateway.CognitoUserPoolsAuthorizer | undefined;
    if (props.userPool) {
      authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'aparoid-authorizer', {
        cognitoUserPools: [props.userPool],
        authorizerName: 'aparoid-jwt-authorizer',
      });
    }

    // API Gateway for Replay Stub Lambda
    this.replayStubApi = new apigateway.RestApi(this, 'aparoid-replay-stub-api', {
      restApiName: 'aparoid-replay-stub-api',
      description: 'API Gateway for replay stub generation with JWT authentication',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: authorizer 
          ? ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key']
          : ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-User-ID'],
      },
    });

    // API Gateway for Replay Data Lambda
    this.replayDataApi = new apigateway.RestApi(this, 'aparoid-replay-data-api', {
      restApiName: 'aparoid-replay-data-api',
      description: 'API Gateway for replay data retrieval with JWT authentication',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: authorizer 
          ? ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key']
          : ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-User-ID'],
      },
    });

    // API Gateway for Replay Tag Lambda
    this.replayTagApi = new apigateway.RestApi(this, 'aparoid-replay-tag-api', {
      restApiName: 'aparoid-replay-tag-api',
      description: 'API Gateway for replay tag management with JWT authentication',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: authorizer 
          ? ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key']
          : ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-User-ID'],
      },
    });

    // Add resources to API Gateway
    const replayStubResource = this.replayStubApi.root.addResource('replay-stub');
    const replayDataResource = this.replayDataApi.root.addResource('replay-data');
    const replayTagResource = this.replayTagApi.root.addResource('replay-tag');

    // Add methods with authorization if authorizer is available
    if (authorizer) {
      replayStubResource.addMethod('POST', new apigateway.LambdaIntegration(this.replayStubLambda), {
        authorizer: authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      });

      replayDataResource.addMethod('POST', new apigateway.LambdaIntegration(this.replayDataLambda), {
        authorizer: authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      });

      replayTagResource.addMethod('POST', new apigateway.LambdaIntegration(this.replayTagLambda), {
        authorizer: authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      });
    } else {
      // Fallback to no authorization (for backward compatibility)
      replayStubResource.addMethod('POST', new apigateway.LambdaIntegration(this.replayStubLambda));
      replayDataResource.addMethod('POST', new apigateway.LambdaIntegration(this.replayDataLambda));
      replayTagResource.addMethod('POST', new apigateway.LambdaIntegration(this.replayTagLambda));
    }

    // Create Lambda integrations
    const replayStubIntegration = new apigateway.LambdaIntegration(this.replayStubLambda, {
      requestTemplates: {
        'application/json': '{ "statusCode": "200" }',
      },
    });

    const replayDataIntegration = new apigateway.LambdaIntegration(this.replayDataLambda, {
      requestTemplates: {
        'application/json': '{ "statusCode": "200" }',
      },
    });

    const replayTagIntegration = new apigateway.LambdaIntegration(this.replayTagLambda, {
      requestTemplates: {
        'application/json': '{ "statusCode": "200" }',
      },
    });

    // Add POST route to root for replay stub API
    this.replayStubApi.root.addMethod('POST', replayStubIntegration, {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Methods': true,
          },
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Methods': true,
          },
        },
      ],
    });

    // Add POST route to root for replay data API
    this.replayDataApi.root.addMethod('POST', replayDataIntegration, {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Methods': true,
          },
        },
        {
          statusCode: '400',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Methods': true,
          },
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Methods': true,
          },
        },
      ],
    });

    // Add POST route to root for replay tag API
    this.replayTagApi.root.addMethod('POST', replayTagIntegration, {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Methods': true,
          },
        },
        {
          statusCode: '400',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Methods': true,
          },
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Methods': true,
          },
        },
      ],
    });

    // Grant permissions to the SLP to Parquet Lambda function
    slpReplayBucket.grantRead(this.slpToParquetLambda);
    processedSlpDataBucket.grantWrite(this.slpToParquetLambda);
    
    // Grant DynamoDB permissions for match deduplication
    const deduplicationTable = dynamodb.Table.fromTableName(
      this, 
      'MatchDeduplicationTable', 
      props.matchDeduplicationTableName
    );
    deduplicationTable.grantReadWriteData(this.slpToParquetLambda);
    
    // Grant permissions to the Replay Stub Lambda function
    tagTable.grantReadData(this.replayStubLambda);
    
    // Grant S3 permissions to the Replay Stub Lambda for Athena query results
    processedSlpDataBucket.grantWrite(this.replayStubLambda);
    
    // Grant cache bucket permissions to the Replay Stub Lambda
    replayCacheBucket.grantReadWrite(this.replayStubLambda);
    
    // Grant additional S3 permissions for Athena output location
    this.replayStubLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetBucketLocation',
        's3:ListBucket',
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
      ],
      resources: [
        `arn:aws:s3:::${props.processedDataBucketName}`,
        `arn:aws:s3:::${props.processedDataBucketName}/*`,
      ],
    }));
    
    replayCacheBucket.grantReadWrite(this.replayDataLambda);
    
    // Grant permissions to the Replay Tag Lambda function
    tagTable.grantWriteData(this.replayTagLambda);
    
    // Grant S3 permissions to the Replay Data Lambda for Athena query results
    processedSlpDataBucket.grantWrite(this.replayDataLambda);
    
    // Grant additional S3 permissions for Athena output location
    this.replayDataLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetBucketLocation',
        's3:ListBucket',
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
      ],
      resources: [
        `arn:aws:s3:::${props.processedDataBucketName}`,
        `arn:aws:s3:::${props.processedDataBucketName}/*`,
      ],
    }));
    
    // Grant Athena permissions to both Lambda functions
    [this.replayStubLambda, this.replayDataLambda].forEach(lambdaFunc => {
      lambdaFunc.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'athena:StartQueryExecution',
          'athena:GetQueryExecution',
          'athena:GetQueryResults',
          'athena:GetWorkGroup',
        ],
        resources: ['*'],
      }));

      // Grant S3 permissions for Athena query results
      lambdaFunc.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          's3:GetBucketLocation',
          's3:GetObject',
          's3:ListBucket',
          's3:ListBucketMultipartUploads',
          's3:ListMultipartUploadParts',
          's3:AbortMultipartUpload',
          's3:PutObject',
        ],
        resources: [
          `arn:aws:s3:::${props.athenaOutputLocation.split('/')[0]}`,
          `arn:aws:s3:::${props.athenaOutputLocation.split('/')[0]}/*`,
        ],
      }));

      // Grant Glue permissions to the Lambda functions
      lambdaFunc.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'glue:GetTable',
          'glue:GetTables',
          'glue:GetDatabase',
          'glue:GetDatabases',
        ],
        resources: [
          `arn:aws:glue:${this.region}:${this.account}:catalog`,
          `arn:aws:glue:${this.region}:${this.account}:database/${props.glueDatabaseName}`,
          `arn:aws:glue:${this.region}:${this.account}:table/${props.glueDatabaseName}/*`,
        ],
      }));
    });

    // Create S3 event notification
    this.s3EventNotification = new s3n.LambdaDestination(this.slpToParquetLambda);

    // Add S3 event notification to trigger Lambda when new SLP files are uploaded
    slpReplayBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      this.s3EventNotification
    );

    // Output the Lambda function names for cross-stack references
    new cdk.CfnOutput(this, 'SlpToParquetLambdaName', {
      value: this.slpToParquetLambda.functionName,
      description: 'Name of the Lambda function for SLP to Parquet conversion',
      exportName: `${this.stackName}-SlpToParquetLambdaName`,
    });

    new cdk.CfnOutput(this, 'ReplayStubLambdaName', {
      value: this.replayStubLambda.functionName,
      description: 'Name of the Lambda function for replay stub generation',
      exportName: `${this.stackName}-ReplayStubLambdaName`,
    });

    new cdk.CfnOutput(this, 'ReplayDataLambdaName', {
      value: this.replayDataLambda.functionName,
      description: 'Name of the Lambda function for replay data retrieval',
      exportName: `${this.stackName}-ReplayDataLambdaName`,
    });

    // Output the API Gateway URLs
    new cdk.CfnOutput(this, 'ReplayStubApiUrl', {
      value: this.replayStubApi.url,
      description: 'URL of the replay stub API Gateway',
      exportName: `${this.stackName}-ReplayStubApiUrl`,
    });

    new cdk.CfnOutput(this, 'ReplayDataApiUrl', {
      value: this.replayDataApi.url,
      description: 'URL of the replay data API Gateway',
      exportName: `${this.stackName}-ReplayDataApiUrl`,
    });

    new cdk.CfnOutput(this, 'ReplayTagApiUrl', {
      value: this.replayTagApi.url,
      description: 'URL of the replay tag API Gateway',
      exportName: `${this.stackName}-ReplayTagApiUrl`,
    });
  }
} 