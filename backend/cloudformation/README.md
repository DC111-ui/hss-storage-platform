# CloudFormation Stack Notes

The `hss-stack.yaml` template is aligned with practical AWS defaults while still supporting a demo deployment.

## Best-practice controls included

- Least-privilege IAM policy for EC2 access to only the inventory S3 bucket and publish to booking SNS topic
- API Gateway REST API (`REGIONAL`) integrated with a Lambda backend (`AWS_PROXY`)
- Lambda execution role with CloudWatch logs permissions and scoped `sns:Publish` access to booking topic
- S3 bucket public access block, encryption at rest, and versioning
- Separate security groups for the web tier and database tier
- RDS restricted to web-tier access only and set to non-public
- RDS backups + encrypted storage + snapshot retention on replacement/deletion
- EC2 IMDSv2 enforcement (`HttpTokens: required`)
- Parameterized SSH CIDR (`AllowedSSHCidr`) so SSH can be scoped
- Explicit VPC and subnet parameters to avoid implicit default networking

## Required parameters

- `VpcId`: target VPC ID
- `WebSubnetId`: subnet for the EC2 web server
- `DBSubnetIds`: subnets for RDS DB subnet group (provide at least 2 in different AZs)
- `KeyName`: existing EC2 key pair
- `DBUsername` and `DBPassword`
- `NotificationEmail` (optional): email endpoint to subscribe to booking lifecycle notifications

## Key outputs

- `RestApiInvokeUrl`: base URL for API Gateway REST API (`/prod` stage)
- `LambdaFunctionArn`: Lambda function ARN used by the REST API
- `BookingEventsTopicArn`: SNS topic for business events/email fan-out

## Validation

You can lint the template locally with:

```bash
cfn-lint -i W1011 -- backend/cloudformation/hss-stack.yaml
```

`W1011` is ignored in this command because secrets are currently passed as parameters for demo simplicity. In production, prefer dynamic references to AWS Secrets Manager or SSM SecureString.
