// stampPredicates.ts — CJS mirror of the floor's two .meta stamp predicates.
//
// The IRIs are owned by shape-validator (src/util/StampPredicate.ts) and wired into the
// floor; this dependency-free mirror exists because (a) markdown-projection has no
// package edge to shape-validator (cross-bundle injection is structural, not nominal),
// and (b) markdownBodyProjector must not import listener.ts for its DEFAULT_STAMP_PRED
// (listener imports the projector — the R-T2 cycle).
//
// The projector needs them to recognise the stamp quads the floor wrote into the PRIOR
// .meta: the stamps are projection-owned, so exact subtraction includes them in
// oldProjected — otherwise stale bodyHash/projectorVersion values accumulate per write.
//
// Drift guards (mirror-test idiom): test/versionAgreement.test.ts pins these equal to
// shape-validator's constants; shape-validator's stampAgreement.test.ts pins the config
// values equal to its constants.
export const STAMP_PRED = "https://pod.vardeman.me/vault/ontology/substrate#bodyHash";
export const VERSION_PRED = "https://pod.vardeman.me/vault/ontology/substrate#projectorVersion";
export const STAMP_PREDS: ReadonlySet<string> = new Set([STAMP_PRED, VERSION_PRED]);
