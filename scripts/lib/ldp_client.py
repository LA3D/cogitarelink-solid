"""Minimal LDP client for CSS. Disposable — replaced by TS CLI (D29)."""
import httpx
from rdflib import Graph


def put_resource(url: str, content: bytes, content_type: str) -> int:
    r = httpx.put(url, content=content,
                  headers={"Content-Type": content_type}, timeout=30)
    r.raise_for_status()
    return r.status_code


def patch_meta(url: str, g: Graph) -> int:
    inserts = g.serialize(format="nt").strip()
    if not inserts: return 200
    n3 = (
        '@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n'
        '<> a solid:InsertDeletePatch;\n'
        f'solid:inserts {{\n{inserts}\n}}.\n'
    )
    r = httpx.patch(f"{url}.meta", content=n3.encode(),
                    headers={"Content-Type": "text/n3"}, timeout=30)
    r.raise_for_status()
    return r.status_code


def get_meta(url: str) -> Graph:
    meta_url = f"{url}.meta"
    r = httpx.get(meta_url, headers={"Accept": "text/turtle"}, timeout=30)
    r.raise_for_status()
    g = Graph()
    # CSS returns relative URIs — resolve against the container URL
    base = url.rsplit("/", 1)[0] + "/"
    g.parse(data=r.text, format="turtle", publicID=base)
    return g
