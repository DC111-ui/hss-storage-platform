# Hatfield Storage Solutions (HSS) Platform

This repository provides a full-stack storage-booking platform demo:

- `frontend/ui`: customer-facing booking and dashboard UI
- `backend/api`: backend API service and lifecycle logic
- `backend/cloudformation`: AWS infrastructure templates/notes
- `docs`: audit and implementation guidance

## Run locally

### 1) Start backend API

```bash
cd backend/api
python3 server.py
```

Backend URL: `http://localhost:8081`

### 2) Start frontend

```bash
cd frontend/ui
python3 -m http.server 8080
```

Open `http://localhost:8080` and set **Backend API base URL** to `http://localhost:8081`.

## What the backend API is

`backend/api/server.py` is the project API layer used by the frontend for:

- login
- booking creation
- staff approval status update
- payment capture (gated by approval)
- audit trail retrieval

In local mode, data is persisted in SQLite (`backend/api/hss.db`) for fast iteration and easy auditing.

## How it connects to AWS

Current code is a local-first reference implementation. AWS integration is achieved by deploying the API runtime on EC2/ECS and replacing local persistence with managed services:

- **Compute:** EC2 or ECS/App Runner
- **Relational data:** RDS MySQL/Postgres
- **Object storage:** S3 for item photos/documents
- **Secrets:** AWS Secrets Manager or SSM Parameter Store
- **Network/security:** VPC security groups, private DB networking, TLS at ALB

See `backend/api/README.md` for the step-by-step migration plan and design rationale.

## Why not DynamoDB (for this iteration)

We prioritized a relational model because this domain currently needs:

- booking + item relationships
- lifecycle state transitions with transactional behavior
- straightforward audit/report queries

DynamoDB is still a valid future option if access patterns become primarily key-value and throughput/scale characteristics justify denormalized redesign.

## Audit documents

- Backend API and AWS integration plan: `backend/api/README.md`
- Platform audit checklist: `docs/README.md`
- CloudFormation controls: `backend/cloudformation/README.md`

## License

For educational and portfolio use.
