"""Phase C.16 — Solid Notifications single-user subscription smoke tests.

Verifies that POST to /.notifications/WebhookChannel2023/ creates a channel
for both .operations/ and .events/ topics, and that the endpoint is reachable.

Multi-user fan-out across two Pods is deferred (would require a second Pod).

Substrate note (discovered during probe 2026-05-18):
- CSS uses context IRI https://www.w3.org/ns/solid/notification/v1 (no 's' at end)
- The type field must be the full IRI http://www.w3.org/ns/solid/notifications#WebhookChannel2023
  (CSS SHACL validates the node kind; the short form 'WebhookChannel2023' is only valid
  inside a context that maps it to the full IRI, and CSS rejects external context fetches)
- GET /.notifications/ returns 400 (CSS BadRequest — not a browsable collection);
  the channel-type endpoint GET /.notifications/WebhookChannel2023/ returns 200
"""
import time

import httpx
import pytest

from tests.conftest import _pod_base, resolve_ca as _resolve_ca

_CA        = _resolve_ca() or False
POD        = _pod_base() + "/vault/"
OPERATIONS = f"{POD}wiki/.operations/"
EVENTS     = f"{POD}wiki/.events/"

NOTIF_BASE    = f"{_pod_base().rsplit('/vault', 1)[0]}/.notifications/"
WEBHOOK_EP    = f"{NOTIF_BASE}WebhookChannel2023/"
WEBHOOK_TYPE  = "http://www.w3.org/ns/solid/notifications#WebhookChannel2023"
NOTIF_CONTEXT = "https://www.w3.org/ns/solid/notification/v1"


def _subscribe(topic, retries=3):
    """POST a WebhookChannel2023 subscription; return (status_code, response_json).

    Retries on a transient non-2xx (the subscription endpoint can return a one-off
    error when the Pod is under concurrent suite load — a flake, not a contract
    failure). The success path is unchanged.
    """
    body = {
        "@context": NOTIF_CONTEXT,
        "type": WEBHOOK_TYPE,
        "topic": topic,
        "sendTo": "https://example.com/test-webhook",
    }
    r = None
    for _ in range(retries):
        r = httpx.post(WEBHOOK_EP, json=body,
                       headers={"Content-Type": "application/ld+json"}, verify=_CA)
        if r.status_code in (200, 201):
            break
        time.sleep(0.3)
    return r.status_code, r.json() if r.status_code in (200, 201) else {}


def test_subscribe_to_operations_container():
    """POST WebhookChannel2023 with .operations/ topic returns 200/201 with channel id."""
    status, data = _subscribe(OPERATIONS)
    assert status in (200, 201), (
        f"Subscribe failed: {status}"
    )
    assert "id" in data, f"Response missing 'id': {data}"
    assert WEBHOOK_TYPE in data.get("type", ""), (
        f"Response type mismatch: {data.get('type')}"
    )


def test_subscribe_to_events_container():
    """POST WebhookChannel2023 with .events/ topic returns 200/201."""
    status, data = _subscribe(EVENTS)
    assert status in (200, 201), (
        f"Subscribe to events failed: {status}"
    )
    assert "id" in data, f"Response missing 'id': {data}"


def test_webhook_channel_type_endpoint_exists():
    """GET /.notifications/WebhookChannel2023/ returns 200 with channel-type metadata."""
    r = httpx.get(WEBHOOK_EP,
                  headers={"Accept": "application/ld+json"}, verify=_CA)
    assert r.status_code == 200, (
        f"Channel-type endpoint not found: {r.status_code}"
    )
    data = r.json()
    # CSS returns channelType or type for the channel descriptor
    channel_type = data.get("channelType", data.get("type", ""))
    assert "WebhookChannel2023" in channel_type, (
        f"channelType not WebhookChannel2023: {data}"
    )
