"""Shared fixtures for cogitarelink-solid tests (pytest/ subdirectory).

Delegates URL resolution to the root conftest so all fixtures honour POD_URL.
"""
import pytest
from tests.conftest import _pod_base


@pytest.fixture
def css_url():
    """Base URL for Community Solid Server (honours POD_URL env var)."""
    return _pod_base()


@pytest.fixture
def comunica_url():
    """Base URL for Comunica SPARQL endpoint."""
    return "http://localhost:8080"


@pytest.fixture
def sparql_url(comunica_url):
    """SPARQL Protocol endpoint URL."""
    return f"{comunica_url}/sparql"
