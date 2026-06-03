import type { Quad } from '@rdfjs/types';
import type { Representation, ResourceIdentifier } from '@solid/community-server';

export interface ProjectionResult {
  quads: Quad[];          // the candidate .meta graph for this body
  governed: string[];     // governed predicate IRIs (for replaceGoverned merge)
}

// Produces the candidate .meta graph from a (non-RDF) body. Implemented per content-type
// by a profile extension (markdown-projection provides the text/markdown one). Returning
// null means "not my content-type / not a governed resource" — the floor treats the body as RDF / lets it pass.
export interface BodyProjector {
  canProject(representation: Representation): boolean;
  project(identifier: ResourceIdentifier, body: string): Promise<ProjectionResult | null>;
}
