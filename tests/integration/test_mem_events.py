"""Phase C.17 — substrate event emission integration tests.

These tests verify that the MemTriggerListener emits mem:Event activities to
/vault/wiki/.events/ in response to substrate-detected conditions.

Currently SKIPPED because MemTriggerListener.onChange dispatch is stubbed —
the detectors (BoundExceeded, ContradictionDetected, ReflectionDue,
UnprocessableWrite) are unit-tested in isolation but their substrate hooks
(shape-validator failure pathway, timer, ldp:contains counter, edge-conflict
analysis) are documented as Phase C follow-ups in FOLLOWUPS.md.

See FOLLOWUPS.md "Phase C.10 wiring scope + deferrals" for the full list.
When those substrate hooks are wired, un-skip these tests to verify emission
against the live Pod.
"""
import pytest


@pytest.mark.skip(
    reason=(
        "MemTriggerListener.checkBound is stubbed; "
        "ldp:contains counter substrate hook pending — "
        "see FOLLOWUPS.md 'Phase C.10 wiring scope + deferrals'"
    )
)
def test_bound_exceeded_emits_event():
    """Writing 13 resources into a fresh container triggers a mem:BoundExceeded event."""
    pass


@pytest.mark.skip(
    reason=(
        "MemTriggerListener does not invoke UnprocessableWriteDetector yet; "
        "shape-validator failure pathway substrate hook pending — "
        "see FOLLOWUPS.md 'Phase C.10 wiring scope + deferrals'"
    )
)
def test_unprocessable_write_emits_event():
    """A SHACL-rejected write produces a mem:UnprocessableWrite event in .events/."""
    pass


@pytest.mark.skip(
    reason=(
        "MemTriggerListener does not invoke ContradictionDetector yet; "
        "edge-conflict analysis substrate hook pending — "
        "see FOLLOWUPS.md 'Phase C.10 wiring scope + deferrals'"
    )
)
def test_contradiction_detected_emits_event():
    """Adding wiki:supports + wiki:criticizes for same object fires mem:ContradictionDetected."""
    pass


@pytest.mark.skip(
    reason=(
        "MemTriggerListener does not invoke ReflectionDueDetector yet; "
        "timer wiring substrate hook pending — "
        "see FOLLOWUPS.md 'Phase C.10 wiring scope + deferrals'"
    )
)
def test_reflection_due_emits_event():
    """After 24h of activity without emission, mem:ReflectionDue should be emitted."""
    pass
