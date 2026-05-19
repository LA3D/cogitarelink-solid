export {
    PAGE_GOVERNED_PREDICATES,
    THING_GOVERNED_PREDICATES,
    WIKI_CLASS_TO_THING_CLASS,
    getThingGovernedPredicates,
    resolveGovernedForWikiClass,
} from "./governedPredicates.js";
export type { TwoSubjectPredicates } from "./governedPredicates.js";
export { projectFrontmatter, resolveCURIE } from "./frontmatterProjection.js";
export type { Frontmatter } from "./frontmatterProjection.js";
export { projectWikilinks, projectWikilink, HINT_TO_PROJECTION } from "./wikilinkProjection.js";
export type { Projection, ProjectionSubject, ProjectWikilinkArgs } from "./wikilinkProjection.js";
export { projectionPipeline, emitSubstrateInvariants } from "./projectionPipeline.js";
export type { SubstrateInvariantsArgs } from "./projectionPipeline.js";
export { MetaWriter, buildTwoSubjectPatch } from "./metaWriter.js";
export type { TwoSubjectPatchArgs } from "./metaWriter.js";
export { detectClass } from "./detectClass.js";
export { resolveThingClass, DEFAULT_WIKI_TYPE_INDEX } from "./typeIndexLookup.js";
export type { TypeIndex } from "./typeIndexLookup.js";
export { TypeIndexLoader } from "./typeIndexLoader.js";
