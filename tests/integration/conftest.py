"""Auto-mark live-Pod tests under tests/integration/ as `integration`.

Many files here exercise the live Pod (HTTP CRUD, projection, SHACL, Memento,
notifications); others are pure offline unit tests (pyshacl shape validation,
vocab/shape agreement) that read local .ttl files and need no Pod. The root
conftest's pytest_runtest_setup gate skips `integration`-marked tests when the Pod
is unreachable, so a Pod-down run reports SKIPs (not ConnectErrors) for the live
ones WITHOUT over-skipping the offline ones (audit §1 item C).

We detect liveness by scanning the test module's source for a live-call signature
(httpx verb / a shared CLIENT verb / _pod_base()). This keeps offline shape tests
runnable Pod-down while gating the real integration tests, without hand-marking
~20 files.
"""
import re

import pytest

_LIVE = re.compile(
    r"httpx\.(get|put|post|patch|delete|head)"
    r"|CLIENT\.(get|put|post|patch|delete|head)"
    r"|_pod_base\(\)"
)

_cache: dict[str, bool] = {}


def _module_is_live(item) -> bool:
    path = str(item.path)
    if path not in _cache:
        try:
            _cache[path] = bool(_LIVE.search(item.path.read_text()))
        except OSError:
            _cache[path] = False
    return _cache[path]


def pytest_collection_modifyitems(items):
    for item in items:
        if _module_is_live(item):
            item.add_marker(pytest.mark.integration)
