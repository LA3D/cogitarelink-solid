"""owner-identity templates parse and produce shape-conforming bodies."""
from pathlib import Path
from rdflib import Graph, Namespace
from pyshacl import validate

TMPL_DIR   = Path(__file__).parent.parent / "overlays" / "owner-identity" / "templates"
SHAPES_DIR = Path(__file__).parent.parent / "overlays" / "owner-identity" / "shapes"
TMPL = Namespace("https://pod.vardeman.me/vault/ontology/template#")

_BASE = "https://pod.vardeman.me/vault/"

PLACEHOLDERS = {
    "<<FULL_NAME>>":     "Charles F. Vardeman II",
    "<<ORCID>>":         "0000-0003-4091-6059",
    "<<WIKI_SLUG>>":     "charles",
    "<<CONTACT_CARD>>":  "/vault/contacts/Person/abc-uuid.ttl#this",
    "<<WIKI_PAGE>>":     "/vault/wiki/people/charles/index.md",
    "<<MEMBERSHIP>>":    "/vault/contacts/Membership/xyz-uuid.ttl#this",
}


def _substitute(body: str) -> str:
    for k, v in PLACEHOLDERS.items():
        body = body.replace(k, v)
    return body


def _strip_comments(body: str) -> str:
    """Drop comment-only lines (those starting with # after optional whitespace).

    Unlike test_addressbook_templates._clean_body, no trailing-semicolon fixup
    is needed: owner-identity template bodies are designed so the active
    section ends with `.`, and any optional commented-out triples are
    independent subjects rather than continuations.
    """
    keep = []
    for line in body.splitlines():
        stripped = line.lstrip()
        if stripped.startswith("#"):
            continue
        keep.append(line)
    return "\n".join(keep)


def test_prefs_init_parses():
    g = Graph().parse(TMPL_DIR / "prefs-init.ttl", format="turtle", publicID=_BASE)
    body = list(g.objects(predicate=TMPL.templateBody))
    assert body, "prefs-init.ttl missing tmpl:templateBody"
    op = list(g.objects(predicate=TMPL.operation))
    assert op and str(op[0]) == "PUT", f"prefs-init operation should be PUT, got {op}"
    target = list(g.objects(predicate=TMPL.targetResource))
    assert target, "prefs-init missing tmpl:targetResource"
    container = list(g.objects(predicate=TMPL.targetContainer))
    assert not container, "prefs-init must NOT have tmpl:targetContainer (uses targetResource for fixed-IRI target)"


def test_prefs_init_body_parses_as_turtle():
    g = Graph().parse(TMPL_DIR / "prefs-init.ttl", format="turtle", publicID=_BASE)
    body = str(list(g.objects(predicate=TMPL.templateBody))[0])
    # The body is a SKELETON with commented-out fields — should parse as empty-ish Turtle.
    Graph().parse(data=body, format="turtle", publicID=_BASE + "settings/prefs.ttl")  # raises if invalid
