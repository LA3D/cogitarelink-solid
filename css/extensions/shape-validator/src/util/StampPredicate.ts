// Default body-hash stamp predicate.
//
// The deployment IRI is wired via config (the AdmissionFloorStore `stampPredicate`
// constructor param, like `storagePath`) so the profile-agnostic floor source names
// no host. This default keeps the floor's unit tests green and is asserted equal to
// both config files by the stampAgreement test. The floor re-exports this as
// STAMP_PRED so importers keep one import site.
export const DEFAULT_STAMP_PRED = 'https://pod.vardeman.me/vault/ontology/substrate#bodyHash';

// Projector-version stamp predicate (PSP spec §6). Written beside the body hash by the
// floor (value = the injected BodyProjector's `version`); read back by the projector on
// the NEXT write to decide exact recompute-subtraction vs degraded pairShadow — recompute
// is only exact within one projector version. Same util home as the body-hash IRI so the
// deployment host stays out of the floor source (the layering test bans it there).
export const VERSION_PRED = 'https://pod.vardeman.me/vault/ontology/substrate#projectorVersion';
