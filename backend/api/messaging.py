"""Messaging integration for backend business events.

Supports an optional AWS SNS publisher that can fan-out booking lifecycle events
for downstream services (notifications, analytics, workflow automation).
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol


class Publisher(Protocol):
    def publish(self, event_type: str, booking_id: str | None, payload: dict[str, Any]) -> None:
        """Publish a business event."""


class NoopPublisher:
    """Fallback publisher when messaging integration is disabled."""

    def publish(self, event_type: str, booking_id: str | None, payload: dict[str, Any]) -> None:  # noqa: ARG002
        return


@dataclass
class SNSPublisher:
    topic_arn: str
    region: str

    def __post_init__(self) -> None:
        import boto3

        self._client = boto3.client("sns", region_name=self.region)

    def publish(self, event_type: str, booking_id: str | None, payload: dict[str, Any]) -> None:
        envelope = {
            "source": "hss-backend-api",
            "event_type": event_type,
            "booking_id": booking_id,
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "payload": payload,
        }
        self._client.publish(
            TopicArn=self.topic_arn,
            Subject=f"hss.{event_type}",
            Message=json.dumps(envelope),
            MessageAttributes={
                "event_type": {"DataType": "String", "StringValue": event_type},
                "booking_id": {"DataType": "String", "StringValue": booking_id or "-"},
            },
        )


def build_publisher_from_env() -> Publisher:
    mode = os.getenv("MESSAGE_BUS_MODE", "disabled").lower()

    if mode != "sns":
        return NoopPublisher()

    topic_arn = os.getenv("SNS_TOPIC_ARN", "").strip()
    region = os.getenv("AWS_REGION", "us-east-1").strip() or "us-east-1"

    if not topic_arn:
        print("[messaging] MESSAGE_BUS_MODE=sns but SNS_TOPIC_ARN is not set. Falling back to NoopPublisher.")
        return NoopPublisher()

    try:
        return SNSPublisher(topic_arn=topic_arn, region=region)
    except Exception as exc:  # noqa: BLE001
        print(f"[messaging] Failed to initialize SNS publisher ({exc}). Falling back to NoopPublisher.")
        return NoopPublisher()
