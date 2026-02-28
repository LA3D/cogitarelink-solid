"""Shared fixtures for cogitarelink-solid tests."""
import pytest


@pytest.fixture
def css_url():
    """Base URL for Community Solid Server (local dev)."""
    return "http://localhost:3000"


@pytest.fixture
def adapter_url():
    """Base URL for Python adapter (local dev)."""
    return "http://localhost:8080"


@pytest.fixture
def oxigraph_url():
    """Base URL for Oxigraph SPARQL endpoint (local dev)."""
    return "http://localhost:7878"
