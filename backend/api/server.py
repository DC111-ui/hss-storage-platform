#!/usr/bin/env python3
"""HSS backend API (dependency-free, SQLite-backed)."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

DB_PATH = Path(__file__).with_name("hss.db")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


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


class Handler(BaseHTTPRequestHandler):
    server_version = "HSSPlatform/1.0"

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw or b"{}")

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/health":
            self._json(200, {"status": "ok", "service": "hss-backend", "timestamp": utc_now()})
            return

        if path == "/api/v1/bookings":
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
            self._json(200, {"bookings": [row_to_dict(r) for r in rows]})
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
                self._json(404, {"error": "Booking not found"})
                return
            payload = row_to_dict(booking)
            payload["items"] = [row_to_dict(i) for i in items]
            self._json(200, payload)
            return

        if path == "/api/v1/audit":
            with sqlite3.connect(DB_PATH) as conn:
                conn.row_factory = sqlite3.Row
                events = conn.execute("SELECT * FROM audit_events ORDER BY id DESC LIMIT 200").fetchall()
            response = []
            for event in events:
                item = row_to_dict(event)
                item["payload"] = json.loads(item["payload"])
                response.append(item)
            self._json(200, {"events": response})
            return

        self._json(404, {"error": "Not found"})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path

        if path == "/api/v1/auth/login":
            body = self._read_json()
            email = (body.get("email") or "").strip().lower()
            if not email:
                self._json(400, {"error": "email is required"})
                return
            token = f"demo-{abs(hash(email)) % 1000000}"
            self._json(200, {"token": token, "role": "customer", "expires_in": 3600})
            return

        if path == "/api/v1/bookings":
            body = self._read_json()
            errors = validate_booking_payload(body)
            if errors:
                self._json(400, {"error": "validation_error", "details": errors})
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
            self._json(201, {"booking_id": booking_id, "status": status})
            return

        if path.endswith("/payment") and path.startswith("/api/v1/bookings/"):
            booking_id = path.split("/")[-2]
            body = self._read_json()
            method = (body.get("method") or "card").lower()
            with sqlite3.connect(DB_PATH) as conn:
                row = conn.execute("SELECT status FROM bookings WHERE id = ?", (booking_id,)).fetchone()
                if not row:
                    self._json(404, {"error": "Booking not found"})
                    return
                if row[0] != "approved":
                    self._json(409, {"error": "Booking must be approved before payment"})
                    return
                payment_reference = f"PAY-{int(datetime.now().timestamp())}"
                conn.execute(
                    "UPDATE bookings SET status = ?, payment_reference = ?, updated_at = ? WHERE id = ?",
                    ("paid", payment_reference, utc_now(), booking_id),
                )
                log_event(conn, "payment_captured", booking_id, {"method": method, "payment_reference": payment_reference})
            self._json(200, {"booking_id": booking_id, "payment_reference": payment_reference, "status": "paid"})
            return

        self._json(404, {"error": "Not found"})

    def do_PATCH(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path.endswith("/status") and path.startswith("/api/v1/bookings/"):
            booking_id = path.split("/")[-2]
            body = self._read_json()
            new_status = body.get("status")
            allowed = {"submitted", "approved", "collected", "in_storage", "returned"}
            if new_status not in allowed:
                self._json(400, {"error": f"status must be one of {sorted(allowed)}"})
                return

            with sqlite3.connect(DB_PATH) as conn:
                found = conn.execute("SELECT id FROM bookings WHERE id = ?", (booking_id,)).fetchone()
                if not found:
                    self._json(404, {"error": "Booking not found"})
                    return
                conn.execute(
                    "UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?",
                    (new_status, utc_now(), booking_id),
                )
                log_event(conn, "status_updated", booking_id, {"status": new_status})
            self._json(200, {"booking_id": booking_id, "status": new_status})
            return

        self._json(404, {"error": "Not found"})


def validate_booking_payload(payload: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    required = ["customer_name", "email", "pickup_date", "pickup_window", "address", "items", "pricing"]
    for field in required:
        if field not in payload:
            errors.append(f"{field} is required")

    if "items" in payload and (not isinstance(payload["items"], list) or len(payload["items"]) < 1):
        errors.append("items must contain at least one entry")

    if "email" in payload and "@" not in str(payload["email"]):
        errors.append("email is invalid")

    pricing = payload.get("pricing", {})
    if pricing:
        for field in ["duration", "monthlySubtotal", "handlingFee", "total"]:
            if field not in pricing:
                errors.append(f"pricing.{field} is required")

    return errors


def run(port: int = 8081) -> None:
    init_db()
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"HSS backend API listening on http://0.0.0.0:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
