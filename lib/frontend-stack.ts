import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class FrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda: replay-data
    const replayDataLambda = new lambda.Function(this, 'ReplayDataLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          return { statusCode: 200, body: 'Replay Data' };
        };
      `),
    });

    // Lambda: replay-stub
    const replayStubLambda = new lambda.Function(this, 'ReplayStubLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          return { statusCode: 200, body: 'Replay Stub' };
        };
      `),
    });

    // Lambda: replay-tag
    const replayTagLambda = new lambda.Function(this, 'ReplayTagLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          return { statusCode: 200, body: 'Replay Tag' };
        };
      `),
    });

    // DynamoDB table for replay tags
    const replayTagsTable = new dynamodb.Table(this, 'ReplayTagsTable', {
      partitionKey: { name: 'replayId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT for production!
    });

    // Example: grant Lambdas read/write access to the table
    replayTagsTable.grantReadWriteData(replayDataLambda);
    replayTagsTable.grantReadWriteData(replayStubLambda);
    replayTagsTable.grantReadWriteData(replayTagLambda);
  }
} 