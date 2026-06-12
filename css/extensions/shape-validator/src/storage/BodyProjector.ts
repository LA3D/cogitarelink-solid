import type { Quad } from '@rdfjs/types';
import type { Representation, ResourceIdentifier } from '@solid/community-server';

export interface ProjectionResult {
  quads: Quad[];          // the candidate .meta graph for this body
  governed: string[];     // governed predicate IRIs (the floor's validation dispatch set)
}

// Pre-commit state of the resource, captured by the floor BEFORE the backend commit
// (CSS's writeMetadataFile clobbers .meta during commit — the D82 root cause; the
// in-band floor is the ONLY component that sees this state). oldBody === null &&
// oldMetaTtl === null is the first-write signature.
export interface ProjectionSnapshot {
  oldBody: string | null;     // resource body before this write
  oldMetaTtl: string | null;  // .meta serialization before this write
}

// Produces the candidate .meta graph from a (non-RDF) body. Implemented per content-type
// by a profile extension (markdown-projection provides the text/markdown one). Returning
// null means "not my content-type / not a governed resource" — the floor treats the body as RDF / lets it pass.
export interface BodyProjector {
  // Projector implementation version. Stamped into .meta beside the body hash (spec §6)
  // so the NEXT write can tell whether exact recompute-subtraction is sound. Flows through
  // the injected instance because the floor is profile-agnostic (it may import nothing
  // from the profile bundle).
  readonly version: string;
  canProject(representation: Representation): boolean;
  project(identifier: ResourceIdentifier, body: string): Promise<ProjectionResult | null>;
  // Read the resource's pre-commit body + .meta. MUST be called before the commit.
  snapshot(identifier: ResourceIdentifier): Promise<ProjectionSnapshot>;
  // Write the given quads to the resource's .meta via provenance-scoped replacement
  // (spec §4: subtract f(body_old) recomputed from the snapshot when exact, pairShadow
  // when degraded — agent-owned triples survive by construction, D81). The projector
  // owns this because MetaWriter is ESM-only and the floor must stay profile-agnostic
  // (no markdown/SKOS/wiki/pipeline symbols may appear in the floor source).
  materialize(
    identifier: ResourceIdentifier,
    quads: Quad[],
    governed: string[],
    snapshot: ProjectionSnapshot,
  ): Promise<void>;
}
