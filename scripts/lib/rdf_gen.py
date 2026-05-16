"""Frontmatter -> RDF triple generation (D7, D31). Minimal -- replaced by TS CLI (D29)."""
import re
from urllib.parse import quote
from rdflib import Graph, URIRef, Literal, Namespace, BNode
from rdflib.namespace import RDF, DCTERMS, XSD, SKOS, PROV

VAULT = Namespace("https://pod.vardeman.me/vault/ontology#")
_PROFILE_BASE = "https://pod.vardeman.me/vault/meta/profiles"

TYPE_MAP = {
    "concept-note": SKOS.Concept,
    "theory-note": VAULT.TheoryNote,
    "literature-note": VAULT.LiteratureNote,
    "method-note": VAULT.MethodNote,
    "project": VAULT.Project,
}

# Maps frontmatter type values (both vault-style and L3 class-hint forms) to
# the PROF profile IRI slug for that resource kind (D86).
CONTENT_PROFILE_MAP = {
    "concept":       f"{_PROFILE_BASE}/concept",
    "concept-note":  f"{_PROFILE_BASE}/concept",
    "source":        f"{_PROFILE_BASE}/source",
    "literature-note": f"{_PROFILE_BASE}/source",
    "book-note":     f"{_PROFILE_BASE}/source",
    "person":        f"{_PROFILE_BASE}/person",
    "author-note":   f"{_PROFILE_BASE}/person",
    "procedure":     f"{_PROFILE_BASE}/procedure",
    "method-note":   f"{_PROFILE_BASE}/procedure",
    "working":       f"{_PROFILE_BASE}/working",
}

FIELD_MAP = {
    "created": (DCTERMS.created, "date"),
    "tags":    (DCTERMS.subject, "tag_list"),
    "related": (SKOS.related, "iri_list"),
    "up":      (DCTERMS.isPartOf, "iri_single"),
    "source":  (DCTERMS.source, "iri_list"),
    "extends": (VAULT.extends, "iri_list"),
    "area":    (VAULT.area, "iri_single"),
    "concept": (VAULT.concept, "iri_list"),
    "supports":(VAULT.supports, "iri_list"),
    "criticizes":(VAULT.criticizes, "iri_list"),
}


def slug(title: str) -> str:
    s = re.sub(r'[^\w\s-]', '', title.strip())
    return re.sub(r'\s+', '-', s).lower()


def _strip_wikilink(val: str) -> str:
    m = re.match(r'\[\[([^\]|]+)(?:\|[^\]]+)?\]\]', val.strip())
    return m.group(1) if m else val.strip()


def _resolve(val: str, base: str) -> URIRef:
    return URIRef(f"{base.rstrip('/')}/{slug(_strip_wikilink(val))}.md")


def frontmatter_to_graph(fm: dict, title: str, base: str,
                         digest: str | None = None,
                         source_path: str | None = None) -> Graph:
    g = Graph()
    g.bind("skos", SKOS); g.bind("dct", DCTERMS)
    g.bind("vault", VAULT); g.bind("prov", PROV)

    subj = URIRef(f"{base.rstrip('/')}/{slug(title)}.md")
    note_type = fm.get("type", "concept-note")
    rdf_class = TYPE_MAP.get(note_type, SKOS.Concept)
    g.add((subj, RDF.type, rdf_class))
    g.add((subj, SKOS.prefLabel, Literal(title, datatype=XSD.string)))

    profile_iri = CONTENT_PROFILE_MAP.get(note_type)
    if profile_iri:
        g.add((subj, DCTERMS.conformsTo, URIRef(profile_iri)))

    for key, (pred, handler) in FIELD_MAP.items():
        val = fm.get(key)
        if val is None: continue
        if handler == "date":
            g.add((subj, pred, Literal(str(val), datatype=XSD.date)))
        elif handler == "tag_list":
            for t in (val if isinstance(val, list) else [val]):
                g.add((subj, pred, Literal(str(t), datatype=XSD.string)))
        elif handler == "iri_list":
            for item in (val if isinstance(val, list) else [val]):
                g.add((subj, pred, _resolve(str(item), base)))
        elif handler == "iri_single":
            g.add((subj, pred, _resolve(str(val), base)))

    if digest:
        g.add((subj, URIRef("http://www.w3.org/2021/ni#digestMultibase"),
               Literal(digest, datatype=XSD.string)))

    if source_path:
        # URL-encode path components to handle spaces in vault paths
        encoded = quote(source_path, safe="/:")
        g.add((subj, PROV.wasDerivedFrom, URIRef(f"file://{encoded}")))

    return g
