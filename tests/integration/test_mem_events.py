"""Phase C.17 — substrate event emission integration tests.

Verifies that MemTriggerListener emits mem:Event activities to
/vault/wiki/.events/ in response to substrate-detected conditions.

Architecture (post-T11/T12-new/T13):
- ShaclValidator + MarkdownProjectionListener invoke cross-extension hooks
  on rejection / projection. Hooks push Turtle into pendingEventsBuffer.
- MemTriggerListener.checkBound + drainPendingEvents run on every 'changed'
  event. Drain emits buffered Turtle to /.events/ via EventEmitter.
- All events multi-typed as `as:Activity, mem:Event, mem:<Subclass>` to
  satisfy the /.events/ path-constraint (literal class check, no inference).

Each test pattern: trigger event → drain via subsequent successful write →
scan /.events/ for the expected mem:* subclass + target URI.
"""
import re
import time
import uuid

import httpx
import pytest


POD = "https://pod.vardeman.me/vault/"
CONCEPTS = f"{POD}wiki/concepts/"
CONTACTS_PERSON = f"{POD}contacts/Person/"
EVENTS = f"{POD}wiki/.events/"

CLIENT = httpx.Client(verify=False, timeout=15)


def _list_events() -> list[str]:
    """Return absolute URLs of all resources currently in /.events/."""
    r = CLIENT.get(EVENTS, headers={"Accept": "text/turtle"})
    r.raise_for_status()
    members = re.findall(r"<([^>]+\.ttl)>", r.text)
    out: list[str] = []
    for m in members:
        if m.startswith("http"):
            out.append(m)
        elif m.startswith("/"):
            out.append(f"https://pod.vardeman.me{m}")
        else:
            # relative — join against EVENTS
            out.append(f"{EVENTS}{m}")
    return list(dict.fromkeys(out))  # de-dupe preserving order


def _find_events_about(target_uri: str, mem_subclass: str) -> list[str]:
    """Fetch each event resource and return URLs whose Turtle mentions both
    the target_uri (as as:object) and the mem:<Subclass>.
    """
    matches: list[str] = []
    for url in _list_events():
        try:
            r = CLIENT.get(url, headers={"Accept": "text/turtle"})
        except httpx.HTTPError:
            continue
        if r.status_code != 200:
            continue
        body = r.text
        if target_uri in body and mem_subclass in body:
            matches.append(url)
    return matches


def _trigger_drain() -> None:
    """Push any successful write through the substrate to flush pendingEventsBuffer."""
    slug = f"drain-{uuid.uuid4().hex[:8]}"
    r = CLIENT.put(
        f"{CONCEPTS}{slug}.md",
        content="# drain trigger\n",
        headers={"Content-Type": "text/markdown"},
    )
    assert r.status_code in (201, 204), f"drain trigger failed: {r.status_code}"


@pytest.mark.skip(
    reason="BoundExceeded integration test — to be implemented per plan T16"
)
def test_bound_exceeded_emits_event():
    """Writing 13 resources into a fresh container triggers a mem:BoundExceeded event."""
    pass


@pytest.mark.skip(
    reason="UnprocessableWrite integration test — to be implemented per plan T17"
)
def test_unprocessable_write_emits_event():
    """A SHACL-rejected write produces a mem:UnprocessableWrite event in .events/."""
    pass


def test_contradiction_detected_emits_event():
    """A markdown body with both [[X]]{.supports} and [[X]]{.criticizes} wikilinks
    projects to .meta as cito:agreesWith + cito:disagreesWith (the configured
    contradictoryPairs in mem-trigger.json). MarkdownProjectionListener's
    postProjectionHook runs ContradictionDetector, which pushes a
    mem:ContradictionDetected Turtle to pendingEventsBuffer. The next
    successful write drains the buffer to /.events/.
    """
    slug = f"test-contra-{uuid.uuid4().hex[:8]}"
    target_url = f"{CONCEPTS}{slug}.md"
    target_this = f"{target_url}#this"

    body = (
        "---\n"
        "type: concept-note\n"
        "prefLabel: contra-test\n"
        "---\n"
        "# contra test\n\n"
        f"This [[{slug}-other]]{{.supports}} something. "
        f"It also [[{slug}-other]]{{.criticizes}} that same thing.\n"
    )
    r = CLIENT.put(
        target_url,
        content=body,
        headers={"Content-Type": "text/markdown"},
    )
    assert r.status_code in (201, 204), f"PUT failed: {r.status_code} {r.text}"

    # Drain the pendingEventsBuffer (MarkdownProjectionListener + MemTriggerListener
    # run in parallel under WorkerParallelInitializer; the contradiction enqueue
    # may not have landed before MemTriggerListener's first drain). A second
    # write forces a guaranteed-fresh drain.
    time.sleep(0.5)
    _trigger_drain()
    time.sleep(1.0)

    matches = _find_events_about(target_this, "mem:ContradictionDetected")
    assert len(matches) >= 1, (
        f"No mem:ContradictionDetected event found for {target_this}. "
        f"Events in /.events/: {_list_events()}"
    )

    # Verify the event carries both contradicting predicates.
    event_body = CLIENT.get(matches[0], headers={"Accept": "text/turtle"}).text
    assert "cito:agreesWith" in event_body or "agreesWith" in event_body, \
        f"Event missing agreesWith predicate: {event_body[:500]}"
    assert "cito:disagreesWith" in event_body or "disagreesWith" in event_body, \
        f"Event missing disagreesWith predicate: {event_body[:500]}"


@pytest.mark.skip(
    reason="ReflectionDue integration test — to be implemented per plan T19 (needs test-mode config from T15)"
)
def test_reflection_due_emits_event():
    """After 24h of activity without emission, mem:ReflectionDue should be emitted."""
    pass
