"""D112 §4/§8: proposal shape — conformant exemplar passes, mutants fail."""
from pathlib import Path
from pyshacl import validate
from rdflib import Graph

SHAPE = Path(__file__).parent.parent / "overlays" / "identifier-schemes" / "shapes" / "curation-proposal.shacl.ttl"

EXEMPLAR = """
@prefix as:     <https://www.w3.org/ns/activitystreams#> .
@prefix mem:    <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix prov:   <http://www.w3.org/ns/prov#> .
@prefix schema: <https://schema.org/> .
@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .

<https://pod.vardeman.me/id/.operations/p1>
    a as:Announce , mem:RealignAction , prov:Activity ;
    as:actor <urn:agent:claude-code> ;
    as:target <https://pod.vardeman.me/id/.operations/> ;
    as:object <https://pod.vardeman.me/id/schemes/doi> ;
    schema:actionStatus schema:PotentialActionStatus ;
    mem:stalenessClass mem:ProviderDrift ;
    mem:rationale "GET https://doi.org/10.5555/x Accept: application/vnd.x -> 406 (2026-06-05T12:00:00Z)." ;
    prov:used <https://doi.org/10.5555/x> ;
    prov:wasAssociatedWith <urn:agent:claude-code> ;
    prov:qualifiedAssociation [
        a prov:Association ;
        prov:agent <urn:agent:claude-code> ;
        prov:hadPlan <https://pod.vardeman.me/vault/meta/affordances/curation.ttl?version=m1> ] ;
    as:published "2026-06-05T12:00:00Z"^^xsd:dateTime .

<urn:agent:claude-code> a prov:SoftwareAgent .
<https://pod.vardeman.me/vault/meta/affordances/curation.ttl?version=m1>
    a prov:Plan ;
    prov:specializationOf <https://pod.vardeman.me/vault/meta/affordances/curation.ttl> .
"""


def _validate(data: str):
    sg = Graph().parse(str(SHAPE), format="turtle")
    dg = Graph().parse(data=data, format="turtle")
    ok, _, report = validate(dg, shacl_graph=sg, inference="none")
    return ok, report


def test_exemplar_conforms():
    ok, report = _validate(EXEMPLAR)
    assert ok, report


def test_missing_rationale_fails():
    ok, _ = _validate(EXEMPLAR.replace(
        'mem:rationale "GET https://doi.org/10.5555/x Accept: application/vnd.x -> 406 (2026-06-05T12:00:00Z)." ;', ""))
    assert not ok


def test_missing_hadplan_fails():
    mutated = EXEMPLAR.replace(
        "prov:hadPlan <https://pod.vardeman.me/vault/meta/affordances/curation.ttl?version=m1> ] ;",
        "] ;")
    ok, _ = _validate(mutated)
    assert not ok, "plan-undeclared proposal must fail (D112: plan-undeclared -> 422)"


def test_bad_action_status_fails():
    ok, _ = _validate(EXEMPLAR.replace(
        "schema:PotentialActionStatus", "schema:ActiveActionStatus"))
    assert not ok


def test_missing_object_fails():
    ok, _ = _validate(EXEMPLAR.replace(
        "as:object <https://pod.vardeman.me/id/schemes/doi> ;", ""))
    assert not ok
