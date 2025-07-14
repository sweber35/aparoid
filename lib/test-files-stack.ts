import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

export interface TestFilesStackProps extends cdk.StackProps {
  slpReplayBucketName: string;
}

export class TestFilesStack extends cdk.Stack {
  public readonly testFilesDeployment: s3deploy.BucketDeployment;

  constructor(scope: Construct, id: string, props: TestFilesStackProps) {
    super(scope, id, props);

    // Import the existing S3 bucket from StorageStack
    const slpReplayBucket = s3.Bucket.fromBucketName(
      this,
      'aparoid-slp-replays-bucket',
      props.slpReplayBucketName
    );

    // Deploy test SLP files to the existing bucket
    this.testFilesDeployment = new s3deploy.BucketDeployment(this, 'aparoid-test-slp-files-deployment', {
      sources: [s3deploy.Source.asset('test-slp-files')],
      destinationBucket: slpReplayBucket,
      destinationKeyPrefix: 'test',
    });

    // Output the deployment info
    new cdk.CfnOutput(this, 'TestFilesDeploymentInfo', {
      value: `Test files deployed to s3://${props.slpReplayBucketName}/test/`,
      description: 'Location where test SLP files were deployed',
      exportName: `${this.stackName}-TestFilesDeploymentInfo`,
    });
  }
} 