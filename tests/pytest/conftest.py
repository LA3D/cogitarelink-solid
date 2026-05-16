"""Shared fixtures for cogitarelink-solid tests."""
import pytest


@pytest.fixture
def css_url():
    """Base URL for Community Solid Server."""
    return "https://pod.vardeman.me"


@pytest.fixture
def comunica_url():
    """Base URL for Comunica SPARQL endpoint."""
    return "http://localhost:8080"


@pytest.fixture
def sparql_url(comunica_url):
    """SPARQL Protocol endpoint URL."""
    return f"{comunica_url}/sparql"
