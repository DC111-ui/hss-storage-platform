# CloudFormation stack (custom UI architecture)

This stack provisions baseline infrastructure for the HSS custom application deployment:

- EC2 instance for hosting the custom UI/API runtime
- RDS MySQL for persistent booking data
- S3 bucket for inventory images/documents
- IAM role and instance profile for EC2 access to S3

## Deploy

```bash
aws cloudformation deploy \
  --template-file hss-stack.yaml \
  --stack-name hss-storage-platform \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    KeyName=<your-keypair> \
    DBUsername=admin \
    DBPassword=<secure-password>
```

## Notes

- This is a demo stack and is intentionally simple.
- Security hardening (private subnets, TLS termination, least privilege IAM, backups) should be added before production use.
