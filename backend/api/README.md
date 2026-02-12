# HSS Backend API

Production-style backend for the HSS storage platform.

## Current implementation (what exists now)

The current server (`backend/api/server.py`) is a **lightweight reference implementation** for local/dev flows:

- Python stdlib HTTP server (no external framework)
- SQLite persistence for `bookings`, `booking_items`, and `audit_events`
- REST lifecycle endpoints for submit → approve → pay
- CORS support for browser frontend integration

This is intentionally simple so you can audit behavior quickly before wiring to managed cloud services.

## API surface

### Health
- `GET /health`

### Auth
- `POST /api/v1/auth/login`
  - body: `{ "email": "student@example.com", "role": "customer|staff|admin" }`
  - response includes inferred role for admin/staff experiences

### Bookings
- `POST /api/v1/bookings` create booking
- `GET /api/v1/bookings` list bookings
- `GET /api/v1/bookings/{booking_id}` booking details with items
- `PATCH /api/v1/bookings/{booking_id}/status` update status (`submitted|approved|collected|in_storage|returned`)
- `POST /api/v1/bookings/{booking_id}/payment` capture payment (only when status is `approved`)

### Audit
- `GET /api/v1/audit` latest audit events (requires `X-HSS-Role: staff|admin`)

### Staff
- `GET /api/v1/staff/queue` (requires `X-HSS-Role: staff|admin`)
- `POST /api/v1/staff/bookings/{booking_id}/approve` (requires `X-HSS-Role: staff|admin`)

### Admin
- `GET /api/v1/admin/overview` (requires `X-HSS-Role: admin`)
- `GET /api/v1/admin/bookings` (requires `X-HSS-Role: admin`)


## How this connects to the frontend

Frontend (`frontend/ui/app.js`) calls this backend via configurable API base URL:

- Login: `POST /api/v1/auth/login`
- Booking submit: `POST /api/v1/bookings`
- Staff approval: `PATCH /api/v1/bookings/{id}/status`
- Payment: `POST /api/v1/bookings/{id}/payment`

Default local backend URL is `http://localhost:8081`.



## REST API -> Lambda architecture (AWS)

The CloudFormation stack now includes an AWS-native serverless entrypoint:

- **Amazon API Gateway (REST API)** receives HTTPS requests.
- **AWS Lambda** is invoked using `AWS_PROXY` integration.
- **Amazon SNS** is used by Lambda for notification fan-out.

### Lambda-backed routes in the template

- `GET /health`
- `POST /api/v1/notifications`

Other paths currently return an integration acknowledgement payload (method/path/request id), so you can incrementally move business routes from the EC2-hosted API to Lambda handlers.

### Practical migration approach

1. Keep customer booking flows on the existing API while validating API Gateway + Lambda in production-like environments.
2. Move staff/admin routes first (`/api/v1/staff/*`, `/api/v1/admin/*`) to Lambda functions behind API Gateway.
3. Move booking and payment routes once persistence/auth layers are in place (RDS, JWT, role claims).
4. Use SNS events as cross-service contracts for notifications and async workflow steps.

## SNS messaging integration (new)

The backend can now emit booking lifecycle business events to an SNS topic for cross-service processing and customer notifications.

### Events published

- `booking_submitted`
- `status_updated`
- `payment_captured`

Each SNS message contains:

- `source` (`hss-backend-api`)
- `event_type`
- `booking_id`
- `occurred_at` (UTC ISO timestamp)
- `payload` (business-specific data)

### Environment configuration

Set these on the API host:

- `MESSAGE_BUS_MODE=sns` to enable SNS publishing (default is disabled/no-op).
- `SNS_TOPIC_ARN=<your-topic-arn>` target topic for events.
- `AWS_REGION=<region>` AWS region for the SNS client (default `us-east-1`).

If SNS config is missing or the client cannot be initialized, the server falls back to no-op publishing so booking flows still work.

### Installing boto3

SNS mode depends on `boto3`:

```bash
pip install boto3
```

## AWS integration plan (recommended)

This is the target deployment mapping for commercial-grade operation:

1. **EC2 (or ECS/App Runner)** hosts the API process.
2. **RDS MySQL/Postgres** replaces SQLite for durable multi-instance relational writes.
3. **S3** stores item images/docs; backend issues pre-signed upload URLs or validates uploaded object keys.
4. **Secrets Manager/SSM** stores DB creds and app secrets.
5. **ALB + HTTPS** fronts the API and enforces TLS.

### Concrete migration steps

1. Add environment-driven config in backend:
   - `DB_ENGINE=sqlite|mysql|postgres`
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
   - `AWS_REGION`, `S3_BUCKET`, `USE_PRESIGNED_UPLOADS=true`
2. Extract DB calls in `server.py` into a repository layer (`storage_sqlite.py`, `storage_rds.py`).
3. Implement schema migration scripts for RDS.
4. Add `/api/v1/uploads/presign` endpoint for direct browser-to-S3 uploads.
5. Enforce API auth (JWT/session validation) and role checks for staff endpoints.
6. Deploy backend as a systemd service (EC2) or container service (ECS/App Runner).

### Why we are **not** using DynamoDB in this version

DynamoDB is a great service, but this project’s current domain model is relational and lifecycle-heavy:

- Booking + item rows are naturally relational (`bookings` ↔ `booking_items`).
- Audit/reporting queries need flexible filtering and ordered retrieval.
- Status transitions and payment gating are easier to enforce with relational constraints/transactions.
- Team familiarity and auditability are typically higher with SQL during early product build-out.

DynamoDB would be a stronger fit if you later optimize for very high write throughput, strict key-based access patterns, and denormalized single-table designs.

## Quick start (local)

```bash
cd backend/api
python3 server.py
```

Service runs on `http://localhost:8081`.

## Audit checklist

1. Validate payload rejection for missing required fields.
2. Confirm lifecycle enforcement (`payment` before approval fails).
3. Confirm booking status transitions are reflected in `GET /api/v1/bookings/{id}`.
4. Inspect `GET /api/v1/audit` after each write operation.
5. Confirm SQLite file (`backend/api/hss.db`) is created/updated in local mode.


## Staff/Admin integration notes

For now, role checks are header-based to keep the reference backend simple:

- Add `X-HSS-Role: staff` for operations-side queue and approvals.
- Add `X-HSS-Role: admin` for management reporting endpoints.

This keeps customer flows unchanged while enabling role-specific backend surfaces for staff and admin dashboards.
