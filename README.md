# Hatfield Storage Solutions (HSS) Platform

This repository has been rebuilt as a modern JavaScript platform:

- **React frontend** (`frontend/react-app`) for the booking user interface.
- **Node.js API** (`backend/node-api`) with Express endpoints.
- **AWS CDK infrastructure** (`infra/cdk`) for deployable cloud resources.

## Project structure

```text
.
├── frontend/react-app     # React + Vite single-page app
├── backend/node-api       # Node.js + Express API
└── infra/cdk              # AWS CDK app (TypeScript)
```

## Prerequisites

- Node.js 20+
- npm 10+
- AWS credentials configured (for CDK deploy)

## Install dependencies

From repository root:

```bash
npm install
```

## Local development

Run backend API:

```bash
npm run dev:backend
```

Run React frontend in another shell:

```bash
npm run dev:frontend
```

The frontend expects the API at `http://localhost:3001` by default.
Set `VITE_API_URL` if you need a different backend endpoint.

## API endpoints

- `GET /health` - service health check
- `GET /api/bookings` - list bookings
- `POST /api/bookings` - create booking

Example payload:

```json
{
  "customerName": "Taylor",
  "unitSize": "Medium"
}
```

## Build and test

```bash
npm run build
npm run test
```

## Deploy with AWS CDK

From root:

```bash
npm run build --workspace infra/cdk
npm run synth --workspace infra/cdk
npm run cdk --workspace infra/cdk deploy
```

The CDK stack provisions:

- VPC and ECS cluster
- Application Load Balanced Fargate service for the Node API
- Private S3 bucket + CloudFront distribution for frontend hosting

## Legacy artifacts

Legacy static frontend, Python API, and CloudFormation references are kept in this repo for history/documentation but are no longer the primary runtime paths.
