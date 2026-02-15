#!/usr/bin/env python3
"""HSS backend API (dependency-free, SQLite-backed)."""

from __future__ import annotations

import json
import re
import sqlite3
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse
from uuid import uuid4

from messaging import build_publisher_from_env

DB_PATH = Path(__file__).with_name("hss.db")
PUBLISHER = build_publisher_from_env()

STAFF_VISIBLE_STATUSES = ("submitted", "approved", "collected", "in_storage")
ALLOWED_STATUSES = {"submitted", "approved", "collected", "in_storage", "returned", "paid"}
STATUS_TRANSITIONS = {
    "submitted": {"approved"},
    "approved": {"collected", "paid"},
    "collected": {"in_storage"},
    "in_storage": {"returned"},
    "returned": set(),
    "paid": {"collected"},
}
ALLOWED_PAYMENT_METHODS = {"card", "eft", "saved card ending in 1042"}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def infer_role(email: str, requested_role: str | None = None) -> str:
    if requested_role in {"customer", "staff", "admin"}:
        return requested_role

    identity = email.lower()
    if identity.startswith("admin") or identity.endswith("@hss-admin.co.za"):
        return "admin"
    if identity.startswith("staff") or identity.endswith("@hss-ops.co.za"):
        return "staff"
    return "customer"


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS bookings (
                id TEXT PRIMARY KEY,
                customer_name TEXT NOT NULL,
                email TEXT NOT NULL,
                pickup_date TEXT NOT NULL,
                pickup_window TEXT NOT NULL,
                address TEXT NOT NULL,
                duration_months INTEGER NOT NULL,
                item_count INTEGER NOT NULL,
                monthly_subtotal REAL NOT NULL,
                handling_fee REAL NOT NULL,
                total REAL NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                payment_reference TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS booking_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                booking_id TEXT NOT NULL,
                item_type TEXT NOT NULL,
                item_name TEXT,
                s3_key TEXT,
                FOREIGN KEY (booking_id) REFERENCES bookings(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS audit_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                booking_id TEXT,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {key: row[key] for key in row.keys()}


def log_event(conn: sqlite3.Connection, event_type: str, booking_id: str | None, payload: dict[str, Any]) -> None:
    conn.execute(
        "INSERT INTO audit_events (event_type, booking_id, payload, created_at) VALUES (?, ?, ?, ?)",
        (event_type, booking_id, json.dumps(payload), utc_now()),
    )


def publish_business_event(event_type: str, booking_id: str | None, payload: dict[str, Any]) -> None:
    try:
        PUBLISHER.publish(event_type=event_type, booking_id=booking_id, payload=payload)
    except Exception as exc:  # noqa: BLE001
        print(f"[messaging] publish failed for {event_type} booking={booking_id}: {exc}")


class Handler(BaseHTTPRequestHandler):
    server_version = "HSSPlatform/2.0"

    def _request_id(self) -> str:
        return self.headers.get("X-Request-Id", "").strip() or uuid4().hex[:12]

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type,X-HSS-Role,X-Request-Id")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS")
        self.send_header("X-Request-Id", payload.get("request_id", self._request_id()))
        self.end_headers()
        self.wfile.write(body)

    def _error(self, status: int, code: str, message: str, details: list[str] | None = None) -> None:
        payload: dict[str, Any] = {"error": {"code": code, "message": message}, "request_id": self._request_id()}
        if details:
            payload["error"]["details"] = details
        self._json(status, payload)

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        if not raw:
            return {}
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Malformed JSON payload: {exc.msg}") from exc
        if not isinstance(parsed, dict):
            raise ValueError("JSON body must be an object")
        return parsed

    def _role(self) -> str:
        role = (self.headers.get("X-HSS-Role", "customer") or "customer").strip().lower()
        return role if role in {"customer", "staff", "admin"} else "customer"

    def _require_role(self, allowed_roles: set[str]) -> bool:
        if self._role() not in allowed_roles:
            self._error(403, "forbidden", "Insufficient permissions", [f"required_roles={sorted(allowed_roles)}"])
            return False
        return True

    def _parse_pagination(self, parsed_query: dict[str, list[str]]) -> tuple[int, int]:
        limit = parsed_query.get("limit", ["50"])[0]
        offset = parsed_query.get("offset", ["0"])[0]
        try:
            limit_num = max(1, min(int(limit), 200))
            offset_num = max(0, int(offset))
        except ValueError as exc:
            raise ValueError("limit and offset must be integers") from exc
        return limit_num, offset_num

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type,X-HSS-Role,X-Request-Id")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/health":
            self._json(200, {"status": "ok", "service": "hss-backend", "version": "2.0", "timestamp": utc_now()})
            return

        if path == "/api/v1/bookings":
            params = parse_qs(parsed.query)
            status_filter = params.get("status", [None])[0]
            try:
                limit, offset = self._parse_pagination(params)
            except ValueError as exc:
                self._error(400, "validation_error", str(exc))
                return

            with sqlite3.connect(DB_PATH) as conn:
                conn.row_factory = sqlite3.Row
                if status_filter:
                    rows = conn.execute(
                        "SELECT * FROM bookings WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
                        (status_filter, limit, offset),
                    ).fetchall()
                else:
                    rows = conn.execute(
                        "SELECT * FROM bookings ORDER BY created_at DESC LIMIT ? OFFSET ?", (limit, offset)
                    ).fetchall()
            self._json(200, {"bookings": [row_to_dict(r) for r in rows], "count": len(rows), "request_id": self._request_id()})
            return

        if path.startswith("/api/v1/bookings/"):
            booking_id = path.split("/")[-1]
            with sqlite3.connect(DB_PATH) as conn:
                conn.row_factory = sqlite3.Row
                booking = conn.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,)).fetchone()
                items = conn.execute(
                    "SELECT item_type, item_name, s3_key FROM booking_items WHERE booking_id = ?", (booking_id,)
                ).fetchall()
            if not booking:
                self._error(404, "not_found", "Booking not found")
                return
            payload = row_to_dict(booking)
            payload["items"] = [row_to_dict(i) for i in items]
            payload["request_id"] = self._request_id()
            self._json(200, payload)
            return

        if path == "/api/v1/staff/queue":
            if not self._require_role({"staff", "admin"}):
                return
            with sqlite3.connect(DB_PATH) as conn:
                conn.row_factory = sqlite3.Row
                placeholders = ",".join("?" for _ in STAFF_VISIBLE_STATUSES)
                rows = conn.execute(
                    f"SELECT * FROM bookings WHERE status IN ({placeholders}) ORDER BY created_at ASC",
                    STAFF_VISIBLE_STATUSES,
                ).fetchall()
            self._json(200, {"queue": [row_to_dict(r) for r in rows], "count": len(rows), "request_id": self._request_id()})
            return

        if path == "/api/v1/admin/bookings":
            if not self._require_role({"admin"}):
                return
            params = parse_qs(parsed.query)
            status_filter = params.get("status", [None])[0]
            with sqlite3.connect(DB_PATH) as conn:
                conn.row_factory = sqlite3.Row
                if status_filter:
                    rows = conn.execute(
                        "SELECT * FROM bookings WHERE status = ? ORDER BY created_at DESC", (status_filter,)
                    ).fetchall()
                else:
                    rows = conn.execute("SELECT * FROM bookings ORDER BY created_at DESC").fetchall()
            self._json(200, {"bookings": [row_to_dict(r) for r in rows], "count": len(rows), "request_id": self._request_id()})
            return

        if path == "/api/v1/admin/overview":
            if not self._require_role({"admin"}):
                return
            with sqlite3.connect(DB_PATH) as conn:
                conn.row_factory = sqlite3.Row
                by_status = conn.execute(
                    "SELECT status, COUNT(*) AS count FROM bookings GROUP BY status ORDER BY status"
                ).fetchall()
                totals = conn.execute(
                    "SELECT COUNT(*) AS total_bookings, COALESCE(SUM(total), 0) AS gross_value, "
                    "COALESCE(SUM(CASE WHEN status='paid' THEN total ELSE 0 END), 0) AS paid_revenue "
                    "FROM bookings"
                ).fetchone()
            self._json(
                200,
                {
                    "total_bookings": totals["total_bookings"],
                    "gross_value": totals["gross_value"],
                    "paid_revenue": totals["paid_revenue"],
                    "status_breakdown": [row_to_dict(r) for r in by_status],
                    "request_id": self._request_id(),
                },
            )
            return

        if path == "/api/v1/audit":
            if not self._require_role({"staff", "admin"}):
                return
            with sqlite3.connect(DB_PATH) as conn:
                conn.row_factory = sqlite3.Row
                events = conn.execute("SELECT * FROM audit_events ORDER BY id DESC LIMIT 200").fetchall()
            response = []
            for event in events:
                item = row_to_dict(event)
                item["payload"] = json.loads(item["payload"])
                response.append(item)
            self._json(200, {"events": response, "request_id": self._request_id()})
            return

        self._error(404, "not_found", "Resource not found")

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        try:
            body = self._read_json()
        except ValueError as exc:
            self._error(400, "validation_error", str(exc))
            return

        if path == "/api/v1/auth/login":
            email = (body.get("email") or "").strip().lower()
            if not email:
                self._error(400, "validation_error", "email is required")
                return
            if not EMAIL_RE.match(email):
                self._error(400, "validation_error", "email is invalid")
                return
            role = infer_role(email, body.get("role"))
            token = f"demo-{role}-{abs(hash(email)) % 1000000}"
            self._json(200, {"token": token, "role": role, "expires_in": 3600, "request_id": self._request_id()})
            return

        if path == "/api/v1/bookings":
            errors = validate_booking_payload(body)
            if errors:
                self._error(400, "validation_error", "Booking payload validation failed", errors)
                return

            booking_id = f"HSS-{int(datetime.now().timestamp())}"
            now = utc_now()
            status = "submitted"
            pricing = body["pricing"]
            with sqlite3.connect(DB_PATH) as conn:
                conn.execute(
                    """
                    INSERT INTO bookings (
                        id, customer_name, email, pickup_date, pickup_window, address,
                        duration_months, item_count, monthly_subtotal, handling_fee, total,
                        status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        booking_id,
                        body["customer_name"].strip(),
                        body["email"].strip().lower(),
                        body["pickup_date"],
                        body["pickup_window"],
                        body["address"].strip(),
                        int(pricing["duration"]),
                        len(body["items"]),
                        float(pricing["monthlySubtotal"]),
                        float(pricing["handlingFee"]),
                        float(pricing["total"]),
                        status,
                        now,
                        now,
                    ),
                )
                for item in body["items"]:
                    conn.execute(
                        "INSERT INTO booking_items (booking_id, item_type, item_name, s3_key) VALUES (?, ?, ?, ?)",
                        (booking_id, item["type"], item.get("name", "").strip(), item.get("s3Key", "")),
                    )
                log_event(conn, "booking_submitted", booking_id, {"email": body["email"], "items": len(body["items"])})
            publish_business_event(
                "booking_submitted",
                booking_id,
                {"email": body["email"].strip().lower(), "item_count": len(body["items"]), "status": status},
            )
            self._json(201, {"booking_id": booking_id, "status": status, "request_id": self._request_id()})
            return

        if path.endswith("/payment") and path.startswith("/api/v1/bookings/"):
            booking_id = path.split("/")[-2]
            method = str(body.get("method") or "card").strip().lower()
            if method not in ALLOWED_PAYMENT_METHODS:
                self._error(400, "validation_error", "Unsupported payment method")
                return
            with sqlite3.connect(DB_PATH) as conn:
                row = conn.execute("SELECT status FROM bookings WHERE id = ?", (booking_id,)).fetchone()
                if not row:
                    self._error(404, "not_found", "Booking not found")
                    return
                if row[0] != "approved":
                    self._error(409, "conflict", "Booking must be approved before payment")
                    return
                payment_reference = f"PAY-{int(datetime.now().timestamp())}"
                conn.execute(
                    "UPDATE bookings SET status = ?, payment_reference = ?, updated_at = ? WHERE id = ?",
                    ("paid", payment_reference, utc_now(), booking_id),
                )
                log_event(conn, "payment_captured", booking_id, {"method": method, "payment_reference": payment_reference})
            publish_business_event(
                "payment_captured",
                booking_id,
                {"method": method, "payment_reference": payment_reference, "status": "paid"},
            )
            self._json(
                200,
                {
                    "booking_id": booking_id,
                    "payment_reference": payment_reference,
                    "status": "paid",
                    "request_id": self._request_id(),
                },
            )
            return

        if path.endswith("/approve") and path.startswith("/api/v1/staff/bookings/"):
            if not self._require_role({"staff", "admin"}):
                return
            booking_id = path.split("/")[-2]
            with sqlite3.connect(DB_PATH) as conn:
                found = conn.execute("SELECT id, status FROM bookings WHERE id = ?", (booking_id,)).fetchone()
                if not found:
                    self._error(404, "not_found", "Booking not found")
                    return
                if found[1] not in {"submitted", "approved"}:
                    self._error(409, "conflict", "Only submitted bookings can be approved")
                    return
                conn.execute(
                    "UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?",
                    ("approved", utc_now(), booking_id),
                )
                actor = self._role()
                log_event(conn, "staff_booking_approved", booking_id, {"status": "approved", "actor_role": actor})
            publish_business_event("staff_booking_approved", booking_id, {"status": "approved", "actor_role": self._role()})
            self._json(200, {"booking_id": booking_id, "status": "approved", "request_id": self._request_id()})
            return

        self._error(404, "not_found", "Resource not found")

    def do_PATCH(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        try:
            body = self._read_json()
        except ValueError as exc:
            self._error(400, "validation_error", str(exc))
            return

        if path.endswith("/status") and path.startswith("/api/v1/bookings/"):
            booking_id = path.split("/")[-2]
            new_status = body.get("status")
            if new_status not in ALLOWED_STATUSES:
                self._error(400, "validation_error", f"status must be one of {sorted(ALLOWED_STATUSES)}")
                return

            with sqlite3.connect(DB_PATH) as conn:
                current = conn.execute("SELECT status FROM bookings WHERE id = ?", (booking_id,)).fetchone()
                if not current:
                    self._error(404, "not_found", "Booking not found")
                    return
                old_status = current[0]
                if new_status == old_status:
                    self._json(200, {"booking_id": booking_id, "status": new_status, "request_id": self._request_id()})
                    return
                if new_status not in STATUS_TRANSITIONS.get(old_status, set()):
                    self._error(409, "conflict", f"Invalid status transition: {old_status} -> {new_status}")
                    return
                conn.execute(
                    "UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?",
                    (new_status, utc_now(), booking_id),
                )
                log_event(conn, "status_updated", booking_id, {"from": old_status, "to": new_status})
            publish_business_event("status_updated", booking_id, {"from": old_status, "to": new_status})
            self._json(200, {"booking_id": booking_id, "status": new_status, "request_id": self._request_id()})
            return

        self._error(404, "not_found", "Resource not found")


def validate_booking_payload(payload: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    required = ["customer_name", "email", "pickup_date", "pickup_window", "address", "items", "pricing"]
    for field in required:
        if field not in payload:
            errors.append(f"{field} is required")

    customer_name = str(payload.get("customer_name", "")).strip()
    if customer_name and len(customer_name) < 2:
        errors.append("customer_name must be at least 2 characters")

    email = str(payload.get("email", "")).strip().lower()
    if email and not EMAIL_RE.match(email):
        errors.append("email is invalid")

    if "items" in payload:
        items = payload["items"]
        if not isinstance(items, list) or len(items) < 1:
            errors.append("items must contain at least one entry")
        else:
            valid_item_types = {"bed", "fridge", "box", "suitcase", "other"}
            for idx, item in enumerate(items, start=1):
                if not isinstance(item, dict):
                    errors.append(f"items[{idx}] must be an object")
                    continue
                item_type = item.get("type")
                if item_type not in valid_item_types:
                    errors.append(f"items[{idx}].type must be one of {sorted(valid_item_types)}")

    pricing = payload.get("pricing", {})
    if pricing:
        for field in ["duration", "monthlySubtotal", "handlingFee", "total"]:
            if field not in pricing:
                errors.append(f"pricing.{field} is required")
        try:
            if int(pricing.get("duration", 0)) < 1:
                errors.append("pricing.duration must be >= 1")
        except (TypeError, ValueError):
            errors.append("pricing.duration must be a number")

    return errors


def run(port: int = 8081) -> None:
    init_db()
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"HSS backend API listening on http://0.0.0.0:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
