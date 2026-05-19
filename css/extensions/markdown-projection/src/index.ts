export {
    governedPredicates,
    GOVERNED_FOR,
    PAGE_GOVERNED_PREDICATES,
    THING_GOVERNED_PREDICATES,
    getThingGovernedPredicates,
} from "./governedPredicates.js";
export { projectFrontmatter } from "./frontmatterProjection.js";
export type { Frontmatter } from "./frontmatterProjection.js";
export { projectWikilinks, projectWikilink, HINT_TO_PROJECTION } from "./wikilinkProjection.js";
export type { Projection, ProjectionSubject, ProjectWikilinkArgs } from "./wikilinkProjection.js";
export { projectionPipeline, emitSubstrateInvariants } from "./projectionPipeline.js";
export type { SubstrateInvariantsArgs } from "./projectionPipeline.js";
export { MetaWriter } from "./metaWriter.js";
export { detectClass } from "./detectClass.js";
export { resolveThingClass } from "./typeIndexLookup.js";
export type { TypeIndex } from "./typeIndexLookup.js";
