"""Root conftest: shared Pod URL resolution, TLS client, and pod-availability skip."""
import os
import subprocess

import httpx
import pytest


# ---------------------------------------------------------------------------
# URL helpers (module-level, importable as well as fixture-accessible)
# ---------------------------------------------------------------------------

def _pod_base() -> str:
    raw = os.environ.get("POD_URL", "https://pod.vardeman.me")
    return raw.rstrip("/")


def _vault_base() -> str:
    return _pod_base() + "/vault"


def resolve_ca():
    """TLS CA for the dev Pod. SSL_CERT_FILE wins; else auto-detect the mkcert CA
    (so callers never have to wrangle the spaces-in-path env var — D85). Else True
    (system CAs) which will fail for a local mkcert cert — verify=False is the last
    resort handled by the caller."""
    f = os.environ.get("SSL_CERT_FILE")
    if f and os.path.exists(f):
        return f
    try:
        root = subprocess.run(
            ["mkcert", "-CAROOT"], capture_output=True, text=True, timeout=5
        ).stdout.strip()
        ca = os.path.join(root, "rootCA.pem")
        if root and os.path.exists(ca):
            return ca
    except (OSError, subprocess.SubprocessError):
        pass
    # Fall back: callers that used verify=False before still work — any CA-resolution
    # failure keeps verify=False (httpx accepts bool or path string).
    return False


def _pod_up() -> bool:
    try:
        return (
            httpx.get(_pod_base() + "/vault/", verify=resolve_ca(), timeout=3).status_code < 500
        )
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def pod_url() -> str:
    """Pod base URL without trailing slash, e.g. https://pod.vardeman.me."""
    return _pod_base()


@pytest.fixture(scope="session")
def vault_url() -> str:
    """Vault root without trailing slash, e.g. https://pod.vardeman.me/vault."""
    return _vault_base()


@pytest.fixture(scope="session")
def pod_client() -> httpx.Client:
    """httpx.Client with TLS resolved for the dev Pod (mkcert or SSL_CERT_FILE)."""
    ca = resolve_ca()
    client = httpx.Client(verify=ca if ca else False, timeout=10)
    yield client
    client.close()


@pytest.fixture(scope="session", autouse=False)
def requires_pod():
    """Skip the test if the Pod is not reachable."""
    if not _pod_up():
        pytest.skip("Pod not running — set POD_URL or start docker compose")


# ---------------------------------------------------------------------------
# Pod-availability gate (audit §1 item C). Any test marked `integration` is
# skipped — not errored — when the Pod is unreachable. The probe runs once per
# session (cached) so a Pod-down run reports clean SKIPs instead of ~100
# ConnectError failures. Tests under tests/integration/ are blanket-marked by
# tests/integration/conftest.py; the live tests in tests/ + tests/pytest/ carry
# `pytestmark = pytest.mark.integration` at module level.
# ---------------------------------------------------------------------------

_POD_UP_CACHE: bool | None = None


def _pod_up_cached() -> bool:
    global _POD_UP_CACHE
    if _POD_UP_CACHE is None:
        _POD_UP_CACHE = _pod_up()
    return _POD_UP_CACHE


def pytest_runtest_setup(item):
    """Skip `integration`-marked tests before ANY fixture runs when the Pod is down.

    A runtest_setup hook fires ahead of fixture instantiation, so module/session-
    scoped live fixtures (seeded_pages, wiki_containers, …) get skipped cleanly
    instead of raising ConnectError at setup. The probe is cached for the session.
    """
    if item.get_closest_marker("integration") and not _pod_up_cached():
        pytest.skip("Pod not running — integration test skipped (set POD_URL or `docker compose up`)")


# ---------------------------------------------------------------------------
# Fold in the tests/pytest/conftest.py fixtures so they're visible repo-wide
# ---------------------------------------------------------------------------

@pytest.fixture
def css_url(pod_url) -> str:
    """Base URL for Community Solid Server (alias for pod_url)."""
    return pod_url


@pytest.fixture
def comunica_url() -> str:
    """Base URL for Comunica SPARQL endpoint."""
    return "http://localhost:8080"


@pytest.fixture
def sparql_url(comunica_url) -> str:
    """SPARQL Protocol endpoint URL."""
    return f"{comunica_url}/sparql"
