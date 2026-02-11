# Hatfield Storage Solutions (HSS) Storage Booking Platform

Hatfield Storage Solutions (HSS) is a **demo cloud platform** for a seasonal student storage business in Hatfield, Pretoria.
The platform showcases how students can request pickup/storage and how administrators can track bookings and inventory using a WordPress-based workflow deployed on AWS.

## What this project demonstrates

- A practical business use case modeled as a cloud solution
- Infrastructure as Code (IaC) with AWS CloudFormation
- A WordPress + WooCommerce-style booking experience (demo scope)
- Supporting services for persistence and media storage (RDS + S3)
- Portfolio-ready architecture and documentation

> [!IMPORTANT]
> This repository is intended for **educational/portfolio use** and is **not production-ready**.

## Core objectives

### Customer capabilities (target)
- Request storage bookings by item type and quantity
- Estimate cost by item mix and storage duration
- Track booking status and stored items
- Use QR-based booking confirmation (demo concept)

### Admin capabilities (target)
- Manage seasonal unit availability
- Track bookings and inventory details
- Map QR identifiers to stored items/bookings

### Infrastructure goals
- Provision AWS infrastructure with CloudFormation
- Keep resources aligned with AWS Free Tier where possible
- Demonstrate repeatable deployment via IaC

## Repository structure

```text
.
├── README.md
├── cloudformation/
│   ├── hss-stack.yaml
│   └── README.md
├── docs/
│   └── README.md
└── wordpress/
    └── custom-plugin/
        └── plugin.php
```

## Current architecture

High-level runtime flow:

```text
Student/User Browser
        │
        ▼
EC2 (WordPress application)
        │
        ▼
RDS MySQL (booking + account data)

EC2 ──(IAM role)──► S3 bucket (inventory photos/documents)
```

Main AWS components in `cloudformation/hss-stack.yaml`:

- **EC2 t3.micro** for the web application host
- **RDS MySQL db.t3.micro** for relational data
- **S3 bucket** for inventory/media assets
- **IAM role + instance profile** for EC2-to-S3 access
- **Security group** allowing HTTP/HTTPS/SSH ingress

## Scope and constraints

### In scope
- WordPress-based booking demo flow
- Basic storage-unit and booking management model
- CloudFormation-driven infrastructure provisioning
- Portfolio documentation and architecture communication

### Out of scope
- Production hardening (private networking, TLS automation, WAF, etc.)
- Real payments and finance-grade transaction controls
- Multi-AZ high availability and autoscaling
- Third-party logistics integrations

### Assumptions
- Storage units are leased from third-party providers
- Operational demand is seasonal and relatively small
- Initial cap is approximately five storage units per season

## Quick start (infrastructure)

### Prerequisites
- AWS account with permissions for EC2, RDS, S3, IAM, and CloudFormation
- AWS CLI configured (`aws configure`)
- Existing EC2 Key Pair in your target region

### Deploy stack

```bash
aws cloudformation create-stack \
  --stack-name hss-demo-stack \
  --template-body file://cloudformation/hss-stack.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameters \
    ParameterKey=KeyName,ParameterValue=<your-keypair-name> \
    ParameterKey=DBUsername,ParameterValue=admin \
    ParameterKey=DBPassword,ParameterValue=<strong-password>
```

### Check outputs

```bash
aws cloudformation describe-stacks \
  --stack-name hss-demo-stack \
  --query "Stacks[0].Outputs"
```

Expected outputs include:
- EC2 public IP
- RDS endpoint
- S3 bucket name

## Known limitations (current template)

- The CloudFormation template currently includes a duplicated `Parameters` section, which should be consolidated for reliable validation/deployment.
- Security defaults are intentionally permissive for demo convenience and should be tightened before any real-world use.

## Suggested next improvements

- Add user-data bootstrapping to install/configure WordPress automatically on EC2
- Move database connectivity to private networking
- Add HTTPS via ACM + ALB or CloudFront
- Expand the custom plugin to model item catalogs, pricing rules, and QR lifecycle
- Fill `docs/` with architecture diagrams, runbooks, and demo screenshots

## License

For educational and portfolio demonstration purposes.
