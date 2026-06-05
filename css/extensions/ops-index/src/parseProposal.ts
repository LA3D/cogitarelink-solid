import type { Quad } from "@rdfjs/types";

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const MEM_REALIGN = "https://pod.vardeman.me/vault/ontology/mem#RealignAction";
const AS_OBJECT = "https://www.w3.org/ns/activitystreams#object";
const SCHEMA_STATUS = "https://schema.org/actionStatus";

// Exported constants: MEM_HAS_OPEN_ACTION and POTENTIAL are also used by
// OperationsIndexListener. NOTE: these IRIs are hardcoded here because there is
// no shared cross-package constants channel in this repo (each CSS extension is
// an isolated npm package). The agreement test
// tests/test_ops_index_mirror_consistency.py should lock these values against
// the live Pod's mem.ttl — a FOLLOWUPS candidate.
export const MEM_HAS_OPEN_ACTION = "https://pod.vardeman.me/vault/ontology/mem#hasOpenAction";
export const POTENTIAL = "https://schema.org/PotentialActionStatus";

export interface Proposal { target: string; status: string }

// Subject scoping: <>-subject resolves to the resource URL on read (LDN), so when
// opUrl is given, only that subject's triples count; without it, any subject typed
// RealignAction (defensive for odd serializations).
export function parseProposal(quads: Quad[], opUrl?: string): Proposal | undefined {
  const mine = (q: Quad): boolean => !opUrl || q.subject.value === opUrl;
  if (!quads.some((q) => mine(q) && q.predicate.value === RDF_TYPE && q.object.value === MEM_REALIGN)) {
    return undefined;
  }
  const target = quads.find((q) => mine(q) && q.predicate.value === AS_OBJECT)?.object.value;
  const status = quads.find((q) => mine(q) && q.predicate.value === SCHEMA_STATUS)?.object.value;
  if (!target || !status) return undefined;
  return { target, status };
}
