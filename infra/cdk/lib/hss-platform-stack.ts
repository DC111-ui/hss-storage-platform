import {
  Stack,
  StackProps,
  CfnOutput,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_ecs_patterns as ecsPatterns,
  aws_ecr_assets as ecrAssets,
  aws_s3 as s3,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'node:path';

export class HssPlatformStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'HssVpc', { maxAzs: 2 });
    const cluster = new ecs.Cluster(this, 'HssCluster', { vpc });

    const backendImage = new ecrAssets.DockerImageAsset(this, 'BackendImage', {
      directory: path.resolve(__dirname, '../../../backend/node-api'),
      file: 'Dockerfile'
    });

    const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'HssApiService', {
      cluster,
      cpu: 256,
      memoryLimitMiB: 512,
      desiredCount: 1,
      taskImageOptions: {
        image: ecs.ContainerImage.fromDockerImageAsset(backendImage),
        containerPort: 3001,
        environment: {
          NODE_ENV: 'production'
        }
      },
      publicLoadBalancer: true
    });

    const frontendBucket = new s3.Bucket(this, 'HssFrontendBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true
    });

    const distribution = new cloudfront.Distribution(this, 'HssFrontendDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket)
      }
    });

    new CfnOutput(this, 'ApiUrl', {
      value: `http://${fargateService.loadBalancer.loadBalancerDnsName}`
    });

    new CfnOutput(this, 'FrontendDistributionUrl', {
      value: `https://${distribution.distributionDomainName}`
    });
  }
}
