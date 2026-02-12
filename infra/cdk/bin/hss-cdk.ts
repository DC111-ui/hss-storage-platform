#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { HssPlatformStack } from '../lib/hss-platform-stack';

const app = new App();

new HssPlatformStack(app, 'HssPlatformStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1'
  }
});
