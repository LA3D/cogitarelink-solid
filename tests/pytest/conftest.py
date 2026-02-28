"""Shared fixtures for cogitarelink-solid tests."""
import pytest


@pytest.fixture
def css_url():
    """Base URL for Community Solid Server (local dev)."""
    return "http://localhost:3000"


@pytest.fixture
def comunica_url():
    """Base URL for Comunica SPARQL endpoint (local dev)."""
    return "http://localhost:8080"


@pytest.fixture
def sparql_url(comunica_url):
    """SPARQL Protocol endpoint URL."""
    return f"{comunica_url}/sparql"
