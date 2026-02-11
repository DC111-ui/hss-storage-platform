# HSS Backend API

Production-style demo backend for the HSS storage platform. This service is intentionally dependency-free (Python stdlib only) so you can run and audit it quickly.

## What is included

- **REST API** for auth, bookings, status transitions, and payment capture.
- **SQLite persistence** for bookings and item-level details.
- **Audit events** table that records lifecycle actions (`booking_submitted`, `status_updated`, `payment_captured`).
- **Validation** for incoming booking payloads.
- **CORS support** for frontend apps served from a different origin.

## Quick start

```bash
cd backend/api
python3 server.py
```

Service runs on `http://localhost:8081` by default.

## API surface

### Health
- `GET /health`

### Auth
- `POST /api/v1/auth/login`
  - body: `{ "email": "student@example.com" }`

### Bookings
- `POST /api/v1/bookings` create booking
- `GET /api/v1/bookings` list bookings
- `GET /api/v1/bookings/{booking_id}` booking details with items
- `PATCH /api/v1/bookings/{booking_id}/status` update status (`submitted|approved|collected|in_storage|returned`)
- `POST /api/v1/bookings/{booking_id}/payment` capture payment (allowed only when status is `approved`)

### Audit
- `GET /api/v1/audit` latest audit events

## Example create booking payload

```json
{
  "customer_name": "Aaliyah Khan",
  "email": "aaliyah@example.com",
  "pickup_date": "2026-07-02",
  "pickup_window": "10:00 – 13:00",
  "address": "17 Campus Road, Hatfield",
  "items": [
    { "type": "bed", "name": "", "s3Key": "s3://hss/orders/bed.jpg" },
    { "type": "box", "name": "Books", "s3Key": "s3://hss/orders/box.jpg" }
  ],
  "pricing": {
    "duration": 3,
    "monthlySubtotal": 310,
    "handlingFee": 350,
    "total": 1280
  }
}
```

## Audit checklist

Use this checklist when reviewing backend quality:

1. Validate payload rejection for missing required fields.
2. Confirm lifecycle enforcement (`payment` before approval should fail).
3. Confirm booking status transitions are reflected in `GET /api/v1/bookings/{id}`.
4. Inspect `GET /api/v1/audit` after each write operation.
5. Confirm SQLite file (`backend/api/hss.db`) is created and updated.
