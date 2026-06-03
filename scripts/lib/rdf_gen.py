"""Frontmatter -> RDF triple generation (D7, D31). Minimal -- replaced by TS CLI (D29)."""
import re
from urllib.parse import quote
from rdflib import Graph, URIRef, Literal, Namespace, BNode
from rdflib.namespace import RDF, DCTERMS, XSD, SKOS, PROV

VAULT = Namespace("https://pod.vardeman.me/vault/ontology#")
WIKI  = Namespace("https://pod.vardeman.me/vault/ontology/wiki#")
_PROFILE_BASE = "https://pod.vardeman.me/vault/meta/profiles"

# Frontmatter type token -> wiki-memory L3 class IRI. RECONCILED (R-T7, audit R3)
# to the TS projection's TYPE_MAP (frontmatterProjection.ts): the two maps are a
# mirror, and this side had drifted to a PRE-D70 legacy `vault:` namespace
# (vault:TheoryNote / LiteratureNote / MethodNote) plus a bare skos:Concept — none
# of which the deployed shape catalog governs (no sh:targetClass for them). The TS
# side is canonical (it writes the live substrate; its wiki: classes dispatch via
# WIKI_CLASS_TO_THING_CLASS to the shapes' sh:targetClass set), so the importer now
# mints the same L3 classes. Agreement test: tests/test_type_map_agreement.py reads
# the maps sidecar (TS typeMap) + this dict + the shapes' sh:targetClass set and
# asserts (a) shared tokens agree and (b) every value is a governed L3 class.
# Coverage still differs by design: TS covers wiki-content tokens; the importer
# covers the vault-author tokens it actually reads (IMPORTABLE_TYPES).
TYPE_MAP = {
    "concept-note":    WIKI.Concept,
    "theory-note":     WIKI.Concept,
    "literature-note": WIKI.Source,
    "method-note":     WIKI.Concept,
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
    # RECONCILED to the canonical TS minter (R-T7, audit R3). wikiUrl.ts:slug() is
    # THE live substrate minter (R-T2 made it the single source of truth for both
    # the rendered <a href> and the projected .meta edge IRI), so the importer must
    # mint byte-identical URLs or its writes collide-or-orphan against substrate
    # writes. This Python slug previously diverged on FOUR vector classes (the live
    # substrate side wins each — cross-language golden vectors in
    # tests/fixtures/slug-vectors.json, run TS-side + Python-side):
    #   1. heading anchor: "Note#Heading" → TS drops "#…"; Python kept "notemy-heading".
    #   2. folder prefix:  "Folder/Note"  → TS keeps last segment; Python merged it.
    #   3. ASCII \w:       "café"         → JS \w is ASCII-only ([A-Za-z0-9_]); Python
    #                                       re \w is Unicode-aware. Use re.ASCII.
    #   4. (citekey "@…" is stripped in targetUrlFor via stripCitekeyMarker, mirrored
    #      below in strip_citekey_marker — applied by _resolve, not by slug itself.)
    # Order must match TS exactly: drop "#…" → drop "Folder/" → trim → strip
    # non-ASCII-[\w\s-] → collapse whitespace → lowercase.
    bare = title.split("#", 1)[0]          # drop heading anchor
    bare = bare.rsplit("/", 1)[-1]         # drop folder prefix (keep last segment)
    s = re.sub(r'[^\w\s-]', '', bare.strip(), flags=re.ASCII)
    return re.sub(r'\s+', '-', s).lower()


def strip_citekey_marker(title: str) -> str:
    # Mirrors wikiUrl.ts:stripCitekeyMarker (S3a rule, D76): strip a leading '@'
    # from citekey titles before slugifying. Applied in the URL-minting path
    # (_resolve / the subject), NOT inside slug() — same split as TS.
    return title[1:] if title.startswith("@") else title


def _strip_wikilink(val: str) -> str:
    m = re.match(r'\[\[([^\]|]+)(?:\|[^\]]+)?\]\]', val.strip())
    return m.group(1) if m else val.strip()


def _resolve(val: str, base: str) -> URIRef:
    target = strip_citekey_marker(_strip_wikilink(val))
    return URIRef(f"{base.rstrip('/')}/{slug(target)}.md")


def frontmatter_to_graph(fm: dict, title: str, base: str,
                         digest: str | None = None,
                         source_path: str | None = None) -> Graph:
    g = Graph()
    g.bind("skos", SKOS); g.bind("dct", DCTERMS)
    g.bind("vault", VAULT); g.bind("prov", PROV)

    subj = URIRef(f"{base.rstrip('/')}/{slug(strip_citekey_marker(title))}.md")
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
