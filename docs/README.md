# HSS implementation and audit guide

## Scope of this delivery

This repository now contains both:

1. A commercial-style frontend booking experience (`frontend/ui`).
2. A backend API with persistence and operational controls (`backend/api`).

## Frontend audit guide

Validate the following in `frontend/ui`:

1. **Responsiveness**: confirm layout adapts from desktop to mobile widths.
2. **Booking workflow**: verify submit → approval → payment progression.
3. **Pricing accuracy**: add/remove items and change duration; confirm totals update.
4. **API interoperability**: set backend URL and confirm submission updates include booking IDs.
5. **Fallback resilience**: stop backend and confirm UI remains functional in local demo mode.

## Backend audit guide

Validate the following in `backend/api`:

1. Start service and confirm `GET /health` returns status JSON.
2. Submit valid and invalid booking payloads; verify validation behavior.
3. Confirm payment endpoint rejects non-approved bookings.
4. Confirm status updates are persisted and retrievable.
5. Inspect `GET /api/v1/audit` to verify event recording.

## Suggested curl checks

```bash
curl -s http://localhost:8081/health | jq
curl -s http://localhost:8081/api/v1/bookings | jq
curl -s http://localhost:8081/api/v1/audit | jq
```

## Cloud/infrastructure audit

For infrastructure controls and CloudFormation guidance see `backend/cloudformation/README.md`.
