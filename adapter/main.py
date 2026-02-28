"""cogitarelink-solid adapter: FastAPI gateway for Solid Pod fabric integration."""
import os
import pathlib
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Response

CSS_URL = os.environ.get("CSS_URL", "http://localhost:3000")
OXIGRAPH_URL = os.environ.get("OXIGRAPH_URL", "http://localhost:7878")
NODE_BASE = os.environ.get("NODE_BASE", "http://localhost:8080")
SHAPES_DIR = pathlib.Path(os.environ.get("SHAPES_DIR", "/app/shapes"))
ONTOLOGY_DIR = pathlib.Path(os.environ.get("ONTOLOGY_DIR", "/app/ontology"))


@asynccontextmanager
async def lifespan(app):
    app.state.css = httpx.AsyncClient(base_url=CSS_URL)
    app.state.oxigraph = httpx.AsyncClient(base_url=OXIGRAPH_URL)
    yield
    await app.state.oxigraph.aclose()
    await app.state.css.aclose()


app = FastAPI(
    title="cogitarelink-solid adapter",
    description="Fabric gateway for Solid Pod — .well-known/ self-description, LDP proxy, vault import",
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/.well-known/void")
async def well_known_void():
    """VoID service description (D12, D15)."""
    void_ttl = _load_template("void")
    return Response(content=void_ttl, media_type="text/turtle")


@app.get("/.well-known/shacl")
async def well_known_shacl():
    """SHACL shapes for Pod content (D11)."""
    shapes = _load_shapes()
    return Response(content=shapes, media_type="text/turtle")


def _load_template(name: str) -> str:
    """Load a .well-known template with {base} substitution."""
    path = ONTOLOGY_DIR / f"{name}.ttl"
    if not path.exists():
        return f"# {name} template not yet generated\n"
    txt = path.read_text()
    return txt.replace("{base}", NODE_BASE)


def _load_shapes() -> str:
    """Concatenate all SHACL shape files with {base} substitution."""
    parts = []
    if SHAPES_DIR.exists():
        for f in sorted(SHAPES_DIR.glob("*.ttl")):
            parts.append(f.read_text())
    if not parts:
        return "# No shapes defined yet\n"
    combined = "\n\n".join(parts)
    return combined.replace("{base}", NODE_BASE)
