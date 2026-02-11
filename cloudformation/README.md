# CloudFormation Stack Notes

The `hss-stack.yaml` template has been aligned with practical AWS best-practice defaults while still supporting a demo deployment.

## Best-practice controls included

- Least-privilege IAM policy for EC2 access to only the inventory S3 bucket
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

## Validation

You can lint the template locally with:

```bash
cfn-lint -i W1011 -- cloudformation/hss-stack.yaml
```

`W1011` is ignored in this command because secrets are currently passed as parameters for demo simplicity. In production, prefer dynamic references to AWS Secrets Manager or SSM SecureString.
