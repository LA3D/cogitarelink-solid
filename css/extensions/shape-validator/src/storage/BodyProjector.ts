import type { Quad } from '@rdfjs/types';
import type { Representation, ResourceIdentifier } from '@solid/community-server';

export interface ProjectionResult {
  quads: Quad[];          // the candidate .meta graph for this body
  governed: string[];     // governed predicate IRIs (the floor's validation dispatch set)
}

// Produces the candidate .meta graph from a (non-RDF) body. Implemented per content-type
// by a profile extension (markdown-projection provides the text/markdown one). Returning
// null means "not my content-type / not a governed resource" — the floor treats the body as RDF / lets it pass.
export interface BodyProjector {
  canProject(representation: Representation): boolean;
  project(identifier: ResourceIdentifier, body: string): Promise<ProjectionResult | null>;
  // Write the given quads to the resource's .meta, replacing the projection's own prior output (pair-shadow until the exact-subtraction snapshot lands)
  // (preserving agent-owned triples, D81). The projector owns this because MetaWriter is
  // ESM-only and the floor must stay profile-agnostic (no markdown/SKOS/wiki/pipeline
  // symbols may appear in the floor source).
  materialize(identifier: ResourceIdentifier, quads: Quad[], governed: string[]): Promise<void>;
}
