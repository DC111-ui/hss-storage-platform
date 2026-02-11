# HSS implementation and audit guide

## Scope

This repository includes:

1. Frontend booking UX (`frontend/ui`)
2. Backend API lifecycle service (`backend/api`)
3. AWS infrastructure definitions (`backend/cloudformation`)

## What to audit now (current reality)

### Frontend

1. Responsiveness across desktop/mobile breakpoints.
2. Booking progression: submit → approve → pay.
3. Pricing updates as items/duration change.
4. API interop with configurable backend URL.
5. Graceful fallback behavior when API is down.

### Backend

1. `GET /health` returns status JSON.
2. Booking payload validation rejects malformed requests.
3. Payment endpoint rejects non-approved bookings.
4. Status updates persist and are retrievable.
5. Audit events are created for writes.

## AWS audit checklist (migration readiness)

Use this when reviewing the move from local SQLite to AWS-managed services:

1. API runtime hosted on EC2/ECS/App Runner behind HTTPS.
2. RDS connectivity configured via private networking and least-privilege SG rules.
3. S3 uploads handled with pre-signed URLs or secure backend proxying.
4. Secrets stored in Secrets Manager/SSM (not plaintext configs).
5. Logging/metrics shipped to CloudWatch.
6. Backup and restore tested for relational data.

## DynamoDB decision note

DynamoDB is not used in the current implementation because this product version favors:

- relational joins between bookings and items
- transactional lifecycle updates
- flexible audit/reporting queries

Re-evaluate DynamoDB when traffic patterns and access shapes become stable enough for single-table denormalized design.

## Suggested checks

```bash
curl -s http://localhost:8081/health | jq
curl -s http://localhost:8081/api/v1/bookings | jq
curl -s http://localhost:8081/api/v1/audit | jq
```

For infrastructure controls, see `backend/cloudformation/README.md`.
