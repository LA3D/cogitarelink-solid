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

// Quad-shaped structural type (avoids a runtime n3 dependency in this mirror module).
interface QuadLike {
    subject: { value: string };
    predicate: { value: string };
}

/**
 * The stamp quads the projection wrote into a PRIOR .meta are projection-owned:
 * exact subtraction must include them in oldProjected so stale bodyHash /
 * projectorVersion values are replaced, never accumulated. ONE definition shared
 * by the floor path (markdownBodyProjector.materialize) and the listener backstop
 * (PSP T5 — hoisted here from the projector's private helper).
 */
export function projectedStampQuads<T extends QuadLike>(quads: T[], resourceUrl: string): T[] {
    return quads.filter((q) => q.subject.value === resourceUrl && STAMP_PREDS.has(q.predicate.value));
}
