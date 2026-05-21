// Shared type definitions for mem-trigger.
// Names match the mem: vocabulary at https://pod.vardeman.me/vault/ontology/mem#

export const MEM = "https://pod.vardeman.me/vault/ontology/mem#";
export const WIKI = "https://pod.vardeman.me/vault/ontology/wiki#";
export const CITO = "http://purl.org/spar/cito/";
export const AS_NS = "https://www.w3.org/ns/activitystreams#";
export const PROV = "http://www.w3.org/ns/prov#";
export const SH = "http://www.w3.org/ns/shacl#";
export const XSD = "http://www.w3.org/2001/XMLSchema#";

// Substrate identity used as as:actor on substrate-emitted events.
// Named URN (NOT a blank node) — N3 Patch rejects blank nodes in solid:inserts.
export const SUBSTRATE_ACTOR = "urn:substrate:mem-trigger-listener";

// Default events container under wiki-memory L3.
export const DEFAULT_EVENTS_CONTAINER =
  "https://pod.vardeman.me/vault/wiki/.events/";
