// Default body-hash stamp predicate.
//
// The deployment IRI is wired via config (the AdmissionFloorStore `stampPredicate`
// constructor param, like `storagePath`) so the profile-agnostic floor source names
// no host. This default keeps the floor's unit tests green and is asserted equal to
// both config files by the stampAgreement test. The floor re-exports this as
// STAMP_PRED so importers keep one import site.
export const DEFAULT_STAMP_PRED = 'https://pod.vardeman.me/vault/ontology/substrate#bodyHash';
