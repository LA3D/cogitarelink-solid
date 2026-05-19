"""Turtle code blocks in extending-l3.md parse cleanly (worked examples are valid).

Some illustrative snippets (manifest fragments, projection output with undeclared
prefixes) are intentionally non-self-contained and tolerate parse failures. Full
vocabulary and shape examples must parse cleanly.
"""
import re
from pathlib import Path
from rdflib import Graph

REPO = Path(__file__).parents[2]
MANUAL = REPO / "overlays/wiki-memory/extending-l3.md"


def _extract_turtle_blocks(md_text: str) -> list[str]:
    """Extract all ```turtle code blocks from the markdown text."""
    return re.findall(r"```turtle\n(.*?)```", md_text, flags=re.DOTALL)


def test_manual_exists_and_has_content():
    assert MANUAL.exists(), f"extending-l3.md not found at {MANUAL}"
    text = MANUAL.read_text()
    assert len(text) > 500, "extending-l3.md appears truncated"


def test_manual_has_turtle_examples():
    blocks = _extract_turtle_blocks(MANUAL.read_text())
    assert len(blocks) >= 3, (
        f"extending-l3.md should contain at least 3 Turtle code blocks "
        f"(biz vocab, biz shape, vault vocab), got {len(blocks)}"
    )


def test_full_overlay_examples_parse():
    """The standalone overlay examples (vocabularies + shapes) parse as valid Turtle.

    Blocks that use undeclared prefixes (manifest fragments, projection output
    snippets) fail gracefully and are tolerated — the constraint is that the
    *standalone vocabulary and shape files* (the ones a reader would copy) must parse.
    """
    blocks = _extract_turtle_blocks(MANUAL.read_text())
    parse_results = []
    for i, block in enumerate(blocks):
        g = Graph()
        try:
            g.parse(data=block, format="turtle")
            parse_results.append((i, True, len(g)))
        except Exception as e:
            parse_results.append((i, False, str(e)[:120]))

    successful = [(i, triples) for i, ok, triples in parse_results if ok]
    failed = [(i, err) for i, ok, err in parse_results if not ok]

    # At least 4 blocks must parse:
    #   Block 2: biz vocabulary (biz.ttl)
    #   Block 3: biz equipment shape (equipment.shacl.ttl)
    #   Block 5: vault vocabulary (vault.ttl) — small but parseable
    #   Block 6: vault literature shape (literature.shacl.ttl)
    assert len(successful) >= 4, (
        f"Expected ≥4 parseable Turtle blocks in extending-l3.md, "
        f"got {len(successful)} successful and {len(failed)} failed.\n"
        f"Parse results: {parse_results}"
    )


def test_biz_vocabulary_block_is_valid():
    """The biz.ttl vocabulary example (block 2) must parse with >5 triples."""
    blocks = _extract_turtle_blocks(MANUAL.read_text())
    assert len(blocks) >= 3, "Not enough Turtle blocks to test biz vocabulary"
    # Block index 2 is the biz vocabulary (after two manifest-fragment blocks)
    g = Graph()
    g.parse(data=blocks[2], format="turtle")
    assert len(g) >= 5, (
        f"biz vocabulary block should have ≥5 triples (ontology + 5 class definitions), "
        f"got {len(g)}"
    )


def test_biz_shape_block_is_valid():
    """The equipment.shacl.ttl shape example (block 3) must parse with >5 triples."""
    blocks = _extract_turtle_blocks(MANUAL.read_text())
    assert len(blocks) >= 4, "Not enough Turtle blocks to test biz shape"
    g = Graph()
    g.parse(data=blocks[3], format="turtle")
    assert len(g) >= 5, (
        f"biz equipment shape block should have ≥5 triples (shape + property shapes), "
        f"got {len(g)}"
    )
