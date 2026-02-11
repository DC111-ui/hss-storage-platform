# Hatfield Storage Solutions (HSS) Platform

This repository now provides a **full-stack demo** of a commercial-grade student storage booking platform:

- `frontend/ui`: polished browser UI with pricing, booking workflow, and backend integration.
- `backend/api`: API service with persistence, lifecycle controls, and audit logs.
- `backend/cloudformation`: AWS infrastructure templates and notes.

## Repository layout

- `frontend/ui/` — static web app prototype with dashboard + 5-step booking flow.
- `backend/api/` — Python REST API (stdlib only, SQLite-backed).
- `backend/cloudformation/` — CloudFormation template aligned to best-practice defaults.
- `docs/` — implementation and audit documentation.

## Run locally

### 1) Start backend API

```bash
cd backend/api
python3 server.py
```

Backend default URL: `http://localhost:8081`

### 2) Start frontend

```bash
cd frontend/ui
python3 -m http.server 8080
```

Open: `http://localhost:8080`

In the booking section, set **Backend API base URL** to `http://localhost:8081`.

## Commercial-grade aspects delivered

### Frontend
- Multi-section, responsive UX designed around trust, transparency, and conversion.
- Structured booking flow with staged status controls (submit → approve → pay).
- Dynamic pricing with item-level modeling and photo preview support.
- Backend-aware flow with graceful local fallback when API is unavailable.

### Backend
- Versioned REST endpoints (`/api/v1/*`) for auth and booking lifecycle.
- Persistent storage with normalized booking/item tables.
- Audit logging of operational events for traceability.
- Status-gated payment endpoint to enforce process control.

## Auditing guides

- Backend technical audit guide: `backend/api/README.md`
- Program-level audit notes: `docs/README.md`
- Infrastructure controls: `backend/cloudformation/README.md`

## License

For educational and portfolio use.
