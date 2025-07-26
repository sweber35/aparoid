import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { CfnDistribution } from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';

export interface FrontendStackProps extends cdk.StackProps {
  // Processing stack to get API URLs from
  processingStack: cdk.Stack;
}

export class FrontendStack extends cdk.Stack {
  public readonly websiteBucket: s3.Bucket;
  public readonly cloudFrontDistribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props?: FrontendStackProps) {
    super(scope, id, props);

    // S3 bucket for static website hosting
    this.websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `${this.account}-${this.region}-aparoid-frontend`,
      publicReadAccess: false, // Keep private for security
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Block all public access
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development - change to RETAIN for production
      autoDeleteObjects: true, // For development - remove for production
      // Remove website configuration since we're using S3Origin
    });

    // CloudFront distribution with S3 website origin
    this.cloudFrontDistribution = new cloudfront.Distribution(this, 'DistributionV2', {
      // Optimize for Cloudflare integration
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Use only North America and Europe
      httpVersion: cloudfront.HttpVersion.HTTP2,
      
      // Add custom domain support
      // domainNames: ['aparoid.bryte.app'],
      // certificate: acm.Certificate.fromCertificateArn(
      //   this,
      //   'CustomDomainCertificate',
      //   'arn:aws:acm:us-east-1:374010404974:certificate/cbc7e134-226c-4c40-99b5-c85032fe5b51'
      // ),
  
      defaultBehavior: {
        origin: new origins.S3Origin(this.websiteBucket, {
          // Use S3Origin instead of S3StaticWebsiteOrigin for better custom domain support
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
      },
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
      defaultRootObject: 'index.html',
      enableLogging: true,
      logBucket: new s3.Bucket(this, 'CloudFrontLogBucket', {
        bucketName: `${this.account}-${this.region}-aparoid-cloudfront-logs`,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
        accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
      }),
      logFilePrefix: 'cloudfront-logs/',
      comment: 'New distribution for testing', // Add a comment to force changes
    });

    // Output the CloudFront URL
    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${this.cloudFrontDistribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL',
      exportName: `${this.stackName}-CloudFrontUrl`,
    });

    // Output the S3 bucket name for deployment scripts
    new cdk.CfnOutput(this, 'WebsiteBucketName', {
      value: this.websiteBucket.bucketName,
      description: 'S3 bucket name for website hosting',
      exportName: `${this.stackName}-WebsiteBucketName`,
    });

    // Output the distribution ID for cache invalidation
    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.cloudFrontDistribution.distributionId,
      description: 'CloudFront Distribution ID',
      exportName: `${this.stackName}-DistributionId`,
    });

    // Note: API Gateway integration is handled via CORS in the ProcessingStack
    // The frontend will make direct calls to the API Gateway URLs

    // Output the API URLs from ProcessingStack for the frontend to use
    new cdk.CfnOutput(this, 'ReplayStubApiUrl', {
      value: cdk.Fn.importValue(`${props!.processingStack.stackName}-ReplayStubApiUrl`),
      description: 'Replay Stub API URL from ProcessingStack',
      exportName: `${this.stackName}-ReplayStubApiUrl`,
    });

    new cdk.CfnOutput(this, 'ReplayDataApiUrl', {
      value: cdk.Fn.importValue(`${props!.processingStack.stackName}-ReplayDataApiUrl`),
      description: 'Replay Data API URL from ProcessingStack',
      exportName: `${this.stackName}-ReplayDataApiUrl`,
    });

    new cdk.CfnOutput(this, 'ReplayTagApiUrl', {
      value: cdk.Fn.importValue(`${props!.processingStack.stackName}-ReplayTagApiUrl`),
      description: 'Replay Tag API URL from ProcessingStack',
      exportName: `${this.stackName}-ReplayTagApiUrl`,
    });
  }
} 