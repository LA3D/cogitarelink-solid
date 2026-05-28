# Test-Suite Audit — consistency vs current architecture (2026-05-28)

**Why:** Surfaced during the D107 URI re-layering. The suite has drifted across several
architecture shifts (D70 wiki-memory-L3 pivot, D98 container/shape renames, D3/D29
CSS-only/client-SPARQL, D84 extension-less vocab, D104 `make audit`, D105/D106
two-hierarchy, D107 `sub:` namespace). This audit maps each test tier to the current
architecture, separates **needed-and-consistent** from **drifted** from **obsolete**, and
recommends a consistent structure. **This is a triage, not the refactor.**

**How verified:** full suite run with `SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem` against
the live Pod (deployed at D107 Phase 4); per-file pass/fail; static set cross-checked at
pre-D107 baseline `9f59311`. Current state: **256 passed, 26 failed, 6 errors, 13 skipped**.

---

## 1. Structural inconsistencies (meta-issues — fix these first; they cause the rot)

| # | Issue | Evidence | Fix |
|---|---|---|---|
| **A** | **`testpaths = ["tests/pytest"]`** points at the *legacy* dir. A bare `pytest` runs only pre-D70 tests, silently skipping the entire current `tests/integration/` suite. | `pyproject.toml:29` | Set `testpaths = ["tests"]` (or remove); keep `make test` = `pytest tests/`. |
| **B** | **Markers defined but never applied.** `integration`/`sparql`/`memento`/`perf` exist in config; **0 files** carry `pytestmark`. Can't `-m "not integration"` to run only offline unit tests. | `pyproject.toml:30-35`; `grep pytestmark tests/` → 0 | Apply `pytestmark = pytest.mark.integration` to every live test file (all of `tests/integration/` + the live ones in `tests/`); `sparql`/`memento` on those subsets. |
| **C** | **No Pod-availability gating.** Live tests fail *hard* (ConnectError/assert) when the Pod is down — indistinguishable from a real regression. Only ad-hoc `pytest.skip` in ~6 files. | `grep skipif tests/` → none | A root `conftest.py` fixture/autouse that probes the Pod once and `pytest.skip`s `integration`-marked tests when it's unreachable. |
| **D** | **Inconsistent TLS.** 39 files use `verify=False`; ~14 rely on `SSL_CERT_FILE` (no verify=False) → fail without the env. This is why "pytest doesn't work" for anyone (incl. subagents) who didn't export the mkcert CA. | `grep verify=False` 39 vs `httpx` 53 | One shared httpx client/fixture in root `conftest.py` that sets the mkcert CA (or `verify=False` for local dev) uniformly. Stop per-file divergence. |
| **E** | **Two conftests, legacy-only.** Only `tests/pytest/conftest.py` exists, with `comunica_url=localhost:8080` (a sidecar dropped per D3/D29). No shared fixtures for the current suite. | `tests/pytest/conftest.py` | Add `tests/conftest.py` (Pod base, TLS client, availability gate); retire the comunica fixture. |
| **F** | **Obsolete + drifted mixed with current**, no markers to tell them apart. | §2/§3 | Triage below. |

---

## 2. Tier map + currency

### Tier 1 — `tests/pytest/` (legacy, the mis-set default testpath) — **MIXED, not all obsolete**
| File | Status | Disposition |
|---|---|---|
| `test_ldp_client.py` (2) | ✅ pass — LDP is L1, current | KEEP (mark `integration`) |
| `test_pod_structure.py` (11) | ✅ pass — structure still valid | KEEP (mark `integration`); audit for false-green vs current containers |
| `test_rdf_gen.py` (6) | ✅ pass — `scripts/lib/rdf_gen.py` exists | KEEP (offline unit) |
| `test_memento.py` (12) | 11 ✅ / 1 ❌ — memento ext current (D61–68) | KEEP; fix/`xfail` `test_vault_data_survives` (depends on vault-import content) |
| `test_vault_import.py` (5) | ❌ all — **OBSOLETE** (D70 pivot; vault-import content not seeded) | REMOVE or rewrite against the L3 importer if still used |
| `test_sparql.py` (6) | ❌ errors — **OBSOLETE here** (needs Comunica sidecar; D3/D29 made SPARQL client-side) | MOVE to `solid-agent-skills` (where Comunica lives) or REMOVE |

### Tier 2 — `tests/integration/` (38 files) — **the needed current-architecture suite**
Mostly ✅ and consistent: shape validations (page/person/place/event/org/howto/working/thing/concept/template), projection + two-subject + two-hierarchy + wikilink + typeindex, mem-operations/events/announcement-log, addressbook + owner-identity e2e, disjointness (D99), fair-metadata, vocab/shape/hint agreement, class/L4 extension, dual-view round-trip (D107). **Drifted:**
| File | Drift | Disposition |
|---|---|---|
| `test_substrate_cleanup.py` (16) | the big one: asserts `pages`/`sources`/`procedure.shacl.ttl` (D98), `ontology/wiki.ttl` (D84 ext-less), "only 4 affordances" (16+ now), `wiki:Page` Type-Index reg (D106), and PARA 404s — **but `resources/` + `resources/concepts/` return 200** (possible real PARA residue, investigate) | FIX to current arch; **much of it is now covered by `make audit` (D104)** — consider trimming overlap, keep only what audit doesn't cover |
| `test_synthesis_page.py` (5) | 1 fail: `howto.shacl.ttl` agentInstruction lacks the synthesis URL | FIX (add ref to howto shape) or relax the "every shape" rule |

### Tier 3 — `tests/` root (unit + some live) — **mixed**
Current/✅: `addressbook_*`, `owner_identity_*`, `overlay_*` parsers, `pod_audit_routing`, `substrate_mirror_consistency` (D107 guard), `wiki_memory_l3_shapes`. **Drifted:**
| File | Drift | Disposition |
|---|---|---|
| `test_phase5j_close.py` (16) | wikirole scheme grew 5→11, manifest profiles grew, `wiki.ttl` `conformsTo rdfs` — tests assert old counts (baseline-proven pre-existing) | FIX counts to current, or re-scope the assertions to "≥N" |
| `test_wiki_memory_l3_listener_integration.py` (~?) | writes to `pages`/`sources` (D98) and `/wiki/...` **without `/vault`** → outside storage root → no projection | FIX paths to `/vault/wiki/{concepts,…}/` (the round-trip in `tests/integration/` already covers the mechanism correctly) |
| `test_wiki_memory_l3_discovery.py::test_wiki_containers_exist` | asserts `pages`/`sources` | FIX to D98 7-container set |
| `test_wiki_memory_l3_traversal.py` (3) | comunica-dependent (skips when unavailable) | already self-skips — OK, but mark `sparql` |

---

## 3. The 32 current red, by disposition

- **REMOVE/relocate (obsolete arch):** `test_vault_import` (5), `test_sparql` (6 err), `test_memento::test_vault_data_survives` (1) = 12.
- **FIX (drifted, tests current arch with stale expectations):** `substrate_cleanup` (6), `phase5j_close` (6), `l3_listener_integration` (6), `discovery::test_wiki_containers_exist` (1), `synthesis howto` (1) = 20.
- **Already fixed this session (D107 lockstep):** `affordance_additive_prof_typing` (4), `affordance_descriptors_parseable` (1), `discovery typeIndex` (1).

---

## 4. Recommended target structure (the refactor, when scheduled)

1. **Fix testpaths** (`tests`), add **`tests/conftest.py`** with: a shared TLS httpx client (mkcert CA), a `pod_available` autouse gate that skips `integration` tests when the Pod is unreachable, and the Pod base URL.
2. **Apply markers** across the suite: `integration` (needs Pod), `sparql` (needs Comunica — and these move to `solid-agent-skills`), `memento`. Then `pytest -m "not integration"` = a fast offline unit run; `make test` = full live run.
3. **Remove/relocate the obsolete** (Tier-1 vault_import/sparql; the 1 memento vault test).
4. **Fix the drifted** to current arch (D98 containers/shapes, wikirole counts, `/vault/wiki/` paths, ext-less vocab). Trim `substrate_cleanup` overlap with `make audit`.
5. **Investigate the `resources/` PARA residue** (`test_no_para_residue` finds 200) — a possible real seed artifact, not D107-related.
6. **Guard against future drift:** `make audit` (D104) is the authoritative substrate-structure check and already gates on a fresh `make reset`; wire `make verify` (D107 Phase 5) + a marked offline unit run into CI so architecture changes surface immediately instead of rotting silently.

**Deeper follow-up (coverage / false-green):** passing live tests were assumed consistent because they pass against the live Pod — but a focused pass should confirm the high-value ones (shape validations, projection invariants, two-hierarchy routing) assert *current* behavior and aren't vacuously green. Sample-audit during the refactor.

**Scope note:** none of this blocks the D107 merge — these failures pre-date D107 (proven). This is a dedicated test-hygiene sprint.
