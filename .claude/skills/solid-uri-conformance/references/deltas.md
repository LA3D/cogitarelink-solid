# URI Conformance — This Pod's Deltas

What this specific Pod commits to, what it currently gets wrong, and what's still open. Read alongside [`spec.md`](spec.md) for the authoritative material.

---

## 1. Commitments going forward (D84)

### Vocabulary namespaces

**Three app-local vocabularies hosted on this Pod:**

| Namespace | IRI |
|---|---|
| wiki-memory L3 application vocab | `https://pod.vardeman.me/vault/ontology/wiki#` |
| Capability catalog vocab (D83) | `https://pod.vardeman.me/vault/ontology/capability#` |
| Overlay machinery vocab | `https://pod.vardeman.me/vault/ontology/overlay#` |

**Rules**: HTTPS, no port, hash-namespace, mnemonic class names, no file extension.

**Vocabulary files at extension-less paths:**

| Vocabulary | File location |
|---|---|
| `wiki:` | `https://pod.vardeman.me/vault/ontology/wiki` |
| `cap:` | `https://pod.vardeman.me/vault/ontology/capability` |
| `overlay:` | `https://pod.vardeman.me/vault/ontology/overlay` |

PUT each with `Content-Type: text/turtle`. CSS handles RDF conneg automatically (Turtle ↔ JSON-LD ↔ N-Triples ↔ ...).

### Cross-Pod shared vocabularies (NOT Pod-hosted)

`fabric:CoreProfile`, `fabric:SolidPodProfile`, and future cross-Pod profile IRIs continue to use **w3id.org**:

- `https://w3id.org/cogitarelink/fabric#CoreProfile`
- `https://w3id.org/cogitarelink/fabric#SolidPodProfile`
- (future) `https://w3id.org/cogitarelink/wiki#WikiMemoryL3Profile` — if and when wiki-memory L3 stabilizes enough to be referenced across many Pods, mint at w3id.org

The rule: **per-Pod app vocab on the Pod; cross-Pod shared profiles on w3id.**

### Profile IRIs distinct from class IRIs

Per PROF §8.3 (`prof:Profile rdfs:subClassOf dct:Standard`), profile IRIs are separate resources from class IRIs:

| Class IRI (owl:Class) | Profile IRI (prof:Profile) |
|---|---|
| `wiki:Page` | `https://pod.vardeman.me/vault/meta/profiles/page` |
| `wiki:Concept` | `https://pod.vardeman.me/vault/meta/profiles/concept` |
| `wiki:Source` | `https://pod.vardeman.me/vault/meta/profiles/source` |
| `wiki:Person` | `https://pod.vardeman.me/vault/meta/profiles/person` |
| `wiki:Procedure` | `https://pod.vardeman.me/vault/meta/profiles/procedure` |
| `wiki:WorkingNote` | `https://pod.vardeman.me/vault/meta/profiles/working` |

Instance data declares both: `rdf:type <class>` + `dct:conformsTo <profile>`.

### Profile descriptors at `/vault/meta/profiles/`

New container alongside `/vault/meta/{shapes,affordances,capabilities}/`. Each profile is a Turtle file at the extension-less path matching its IRI. See [`templates.md`](templates.md) Template A.

### Link rel=profile MetadataWriter (D86)

CSS extension `css/extensions/profile-link/` emits `Link: <profile-IRI>; rel="profile"` header on every resource GET (parallels D67 `MementoLinkMetadataWriter` pattern — additive, never overwrites). Inserted into the `MetadataWriter` ParallelHandler after `MetadataWriter_LinkRel`.

### `_profile=alt` introspection

QSA query parameter `?_profile=alt` returns the list-profiles representation (catalog of available profile × media-type combos). Spec reserved token is **`alt`**, not `alternates`.

### Explicit `prof:isTransitiveProfileOf` emission

Don't rely on reasoners applying the at-risk PROF §8.4.2 chain axiom. When a profile has ancestors, emit the full chain explicitly:

```turtle
<…/profiles/concept> a prof:Profile ;
  prof:isProfileOf <…/profiles/page> ;
  prof:isTransitiveProfileOf <…/profiles/page> ,
                             <https://solidproject.org/TR/protocol> .
```

### What we DO NOT emit

- ❌ `Content-Profile` header — only in the expired IETF draft. Use `Link: rel="profile"` instead.
- ❌ Port numbers in vocabulary IRIs.
- ❌ `http://` for vocabulary IRIs (server runs HTTPS).
- ❌ `.ttl` extensions in vocabulary IRIs.
- ❌ Mnemonic-named entity slugs that encode meaning ("Q-numbers for entities" rule doesn't apply to us — vault notes have natural slugs and are stable).

---

## 2. TLS deployment (D85)

### Dev: mkcert + CSS native HTTPS

```bash
brew install mkcert nss
mkcert -install                              # installs root CA into macOS Keychain
mkdir -p css/certs
cd css/certs
mkcert -cert-file pod.crt -key-file pod.key \
  pod.vardeman.me localhost 127.0.0.1 ::1
cp "$(mkcert -CAROOT)/rootCA.pem" ./rootCA.pem
```

docker-compose changes:

```yaml
services:
  css:
    ports:
      - "443:3443"                          # external 443 → internal 3443
    volumes:
      - ./css/certs:/certs:ro
    environment:
      NODE_EXTRA_CA_CERTS: /certs/rootCA.pem
    command:
      - -c
      - /config/solid-config.json
      - -c
      - "@css:config/http/server-factory/https-no-websockets.json"
      - -f
      - /data
      - -b
      - https://pod.vardeman.me                # baseUrl — port-less
      - --httpsKey
      - /certs/pod.key
      - --httpsCert
      - /certs/pod.crt
      - --seedConfig
      - /config/seed.json
```

Final URL: `https://pod.vardeman.me/` — no port visible. Cert validity: 825 days (Apple cap on user-installed CAs).

### Prod: Caddy + Let's Encrypt DNS-01

Real DNS subdomain, Caddy reverse proxy, DNS-01 challenge via Cloudflare/Route53/etc. Same hostname dev↔prod so vocabulary IRIs don't change again on deploy.

### Client gotchas (CRITICAL)

| Client | Fix |
|---|---|
| **Node.js / Comunica / Bashlib / @inrupt/* / inrupt-authn-node** | `export NODE_EXTRA_CA_CERTS=$(mkcert -CAROOT)/rootCA.pem` in shell **and** in any sibling Docker container env. Node uses bundled OpenSSL trust, not Keychain. |
| **Python httpx / requests** | `export SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem` (and `REQUESTS_CA_BUNDLE` for requests). Same root cause. |
| **macOS curl / browsers** | Just work — they read Keychain. |
| **Docker container clock skew** | If container clock is >5min behind host, cert "isn't valid yet." Rare on macOS, watch for it on Linux after suspend. |
| **HSTS** | Off in dev (Chrome pinning gotcha if you ever fall back). On in prod, start `max-age=300` then ratchet. |

---

## 3. Known-wrong current state (RQ-Substrate-3)

The following files use the **broken-current** form. Pre-flight audit run 2026-05-16 produced this complete migration manifest. All must be migrated as part of task 7 in the implementation plan.

### Substitution rules

| Find | Replace |
|---|---|
| `urn:example:wiki#` | `https://pod.vardeman.me/vault/ontology/wiki#` |
| `http://pod.vardeman.me:3000/vault/ontology/wiki#` | `https://pod.vardeman.me/vault/ontology/wiki#` |
| `http://pod.vardeman.me:3000/vault/ontology/capability#` | `https://pod.vardeman.me/vault/ontology/capability#` |
| `http://pod.vardeman.me:3000/vault/ontology/overlay#` | `https://pod.vardeman.me/vault/ontology/overlay#` |
| `http://pod.vardeman.me:3000/vault/` (resource URLs) | `https://pod.vardeman.me/vault/` |
| `http://pod.vardeman.me:3000` (baseUrl) | `https://pod.vardeman.me` |
| Overlay `hostedAt "/vault/ontology/wiki.ttl"` | `hostedAt "/vault/ontology/wiki"` (extension dropped) |

### Files to migrate (50 total)

**A. Substrate config (3)** — CSS startup, Docker, void-description:
- `css/config/solid-config.json`
- `css/config/void-description.json`
- `docker-compose.yml`

**B. Pod templates (5)** — base capabilities + ontology files installed on init:
- `css/config/pod-templates/base/meta/capabilities/{derived-view,markdown-content-projection,time-travel}.ttl`
- `css/config/pod-templates/base/ontology/{capability,overlay}.ttl`

**C. Wiki-memory overlay (13)** — manifest, storage patch, vocabulary, shapes, affordances:
- `overlays/wiki-memory/manifest.ttl`
- `overlays/wiki-memory/storage-patch.ttl`
- `overlays/wiki-memory/context-fragment.jsonld`
- `overlays/wiki-memory/vocabulary/wiki.ttl`
- `overlays/wiki-memory/shapes/{page,person,procedure,source,working}.shacl.ttl`
- `overlays/wiki-memory/affordances/{breadcrumb-view,hub-view,markdown-projection,memento}.ttl`

**D. CSS extension source (9)** — TypeScript + tests:
- `css/extensions/markdown-projection/src/{frontmatterProjection,governedPredicates}.ts`
- `css/extensions/markdown-projection/test/{frontmatterProjection,governedPredicates}.test.ts`
- `css/extensions/markdown-render/src/cli.ts`
- `css/extensions/markdown-render/tests/{render,resolver}.test.ts`
- `css/extensions/metadata-card/src/cli.ts`
- `css/extensions/metadata-card/tests/{parse,render}.test.ts`
- `css/extensions/shared/markdown-parsing/src/resolver.ts`

**E. Legacy SHACL shapes (6)** — source shapes (overlay copies these):
- `shapes/wiki-memory-l3/{concept,person,procedure,resource,source,working}.shacl.ttl`

**F. Python scripts (5)**:
- `scripts/load_l3_fixtures.py`
- `scripts/overlay/{apply,common}.py`
- `scripts/pod_setup.py`
- `scripts/vault_import.py`

**G. Tests + fixtures (11)**:
- `tests/test_wiki_memory_l3_{discovery,listener_integration,traversal}.py`
- `tests/pytest/{conftest,test_ldp_client,test_memento,test_pod_structure,test_rdf_gen,test_sparql,test_vault_import}.py`
- `tests/integration/test_substrate_cleanup.py`
- `tests/fixtures/wiki-memory-l3/shape-stubs/{procedure,working-note}-stub.ttl`

**H. Documentation & skill references (3)** — also need updating:
- `.claude/skills/comunica-sources/SKILL.md`
- `.claude/skills/solid-wiki-memory-l3/references/{design,rung-1-4-implementation}.md`
- `css/extensions/metadata-card/README.md`
- `FOLLOWUPS.md`

**The D81 governance break this causes**: listener emits triples in `urn:example:wiki#` namespace, while live SHACL shapes installed by the overlay declare governed predicates in `http://pod.vardeman.me:3000/vault/ontology/wiki#`. Predicate-set comparison fails silently. Migration fixes this.

**Migration execution strategy**: mechanical substitutions are safe to do with `sed`-style replace_all on individual files. Sequence: (1) TLS turn-up first so https endpoints actually work; (2) wipe `css-data` volume so CSS doesn't carry stale absolute IRIs in stored `.meta`; (3) edit all files; (4) restart Pod; (5) re-run integration tests.

---

## 3a. Implementation status (Phase 5j)

| Component | Status |
|---|---|
| D84 URI conformance commitments | ✅ shipped (all 55+ source files migrated; volume wiped; Pod regenerated with new IRIs) |
| D85 TLS deployment (mkcert) | ✅ shipped (CSS native HTTPS, no -k needed, Node trust via NODE_EXTRA_CA_CERTS) |
| Extension-less vocab file at `/vault/ontology/wiki` | ✅ shipped (Pod serves with auto-conneg verified) |
| 5 PROF profile descriptors | ✅ written (`overlays/wiki-memory/profiles/{page,concept,source,person,procedure,working}.ttl`) |
| Profile catalog at `/vault/meta/profiles/` | ⏳ files exist in overlay; need overlay-apply integration to install them on Pod (deferred — overlay manifest schema needs `installsProfile` predicate) |
| `Link: rel="profile"` MetadataWriter CSS extension | ⏳ designed in skill + templates.md; not yet implemented. Mirrors D67 MementoLinkMetadataWriter pattern. Deferred to follow-up commit. |
| `_profile=alt` introspection view | ⏳ part of MetadataWriter extension; deferred |
| Update wiki-memory L3 skill cross-reference | (task 9) |

**Deferred work** lives in a clean follow-up commit so this commit ships a coherent vertical slice (URIs migrated + TLS up + Pod regenerated + PROF descriptors committed). The MetadataWriter is small (~30 LOC, see `css/extensions/memento/src/MementoLinkMetadataWriter.ts` for the template); the overlay schema extension (`installsProfile`) is also small. Both are isolated and reviewable.

## 4. Empirical CSS conformance test result

**Status: ✅ PASSED** (run 2026-05-16 against CSS v8.0.0-alpha.3 at `http://pod.vardeman.me:3000`).

Test sequence and verbatim results:

| # | Operation | Result |
|---|---|---|
| 1 | `PUT /vault/_uri_conformance_test` (no extension) + `Content-Type: text/turtle` + Turtle body | **201 Created** |
| 2 | `GET` + `Accept: text/turtle` | **200 OK**, Content-Type: `text/turtle`, original Turtle returned verbatim |
| 3 | `GET` + `Accept: application/ld+json` | **200 OK**, Content-Type: `application/ld+json`, auto-converted JSON-LD with full IRIs |
| 4 | `GET` + `Accept: application/n-triples` | **200 OK**, Content-Type: `application/n-triples`, auto-converted N-Triples |
| 5 | Link headers on GET | `<…ldp#Resource>; rel="type"`, `…?ext=timemap; rel="timemap"`, `…; rel="timegate"`, `….meta; rel="describedby"`, `…/.well-known/solid; rel="solid:storageDescription"` |
| 6 | `DELETE` | **205** (CSS resource-removal status) |

**Conclusion**: CSS v8 alpha treats RDF as a first-class data format with the internal-pathfinding conneg (per Van Herwegen & Verborgh 2024). Storing Turtle and serving as JSON-LD, N-Triples, or any other supported RDF format is automatic. **D84's extension-less vocabulary IRI commitment is confirmed working.**

**Side findings worth noting**:
- CSS even serializes error responses with conneg — a 404 returns Turtle/JSON-LD/N-Triples error descriptions depending on Accept. Free conformance for error tooling.
- Memento headers (`timemap`/`timegate`) and storage-description Link auto-attach to every resource. The MetadataWriter pattern this Pod uses (D67) is what makes that work; the D86 `Link: rel="profile"` MetadataWriter slots into the same chain.

---

## 5. Open questions

### a. Profile catalog discovery

Three options for telling agents where the profile catalog lives:

1. **Storage description `rdfs:seeAlso`** — generic, no new predicate needed:
   ```turtle
   <> rdfs:seeAlso </vault/meta/profiles/> .
   ```
2. **Typed predicate `wiki:profileCatalog`** — explicit but mints a new predicate:
   ```turtle
   <> wiki:profileCatalog </vault/meta/profiles/> .
   ```
3. **Both** — `seeAlso` for generic agents + `wiki:profileCatalog` for typed discovery.

Decision deferred to task 8 (PROF descriptors landing). My recommendation: **option 3** — generic crawl works, typed discovery is fast.

### b. CSS v8 alpha extension-less PUT/GET conformance

Empirical question; see §4 above.

### c. Migration of stored `.meta` triples

CSS persists absolute IRIs into `.meta` at write time. Changing `-b` only affects new writes. Migration path:

1. Wipe `css-data` volume (`docker compose down -v`).
2. Restart with new baseUrl + new namespace IRIs everywhere in config + overlay.
3. Re-apply overlay (recreates wiki-memory L3 surface in the new form).
4. Re-import any data fixtures.

Required because in-place rewriting of `.meta` files inside a running CSS would race against MonitoringStore writes. Done once as part of task 7.

### d. Migration path for OTHER Pods that have already referenced our IRIs

If/when another Pod has stored `dct:conformsTo http://pod.vardeman.me:3000/vault/ontology/wiki#WikiMemoryProfile`, what's our obligation? Short answer:

- **In Solid spec**: only `410 Gone` is normative for URI persistence. No 301/308 obligation.
- **In practice**: serve HTTP 301/308 redirects from the old form to the new form for at least 6 months after a migration. Out of scope for task 7 (no external Pods reference our IRIs yet — this is still all in-repo).

### e. RQ-Listener-1 interaction

The MarkdownProjectionListener's predicate-set logic uses `urn:example:wiki#` hardcoded. After namespace migration, this becomes `https://pod.vardeman.me/vault/ontology/wiki#`. Verify the listener still works against the migrated shapes — the predicate set is referenced by URI, so changing the URI on both sides should be consistent. Re-run the integration test (currently xfailed for RQ-Listener-1) and see if anything changes.

---

## 6. Verification commands (after task 7)

```bash
# 1. Storage description returns https IRIs with no port
curl -L -H "Accept: text/turtle" https://pod.vardeman.me/.well-known/solid \
  | grep -E "https?://pod\.vardeman\.me"
# Expected: every URL is https:// with no :3000

# 2. Vocabulary dereferences extension-lessly
curl -H "Accept: text/turtle" https://pod.vardeman.me/vault/ontology/wiki \
  | head -20
# Expected: 200 OK, Turtle with @prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#>

# 3. Auto-conneg to JSON-LD
curl -H "Accept: application/ld+json" https://pod.vardeman.me/vault/ontology/wiki \
  | jq '.["@context"]' | head -5
# Expected: 200 OK, JSON-LD with @context including wiki namespace

# 4. Profile catalog browseable
curl -H "Accept: text/turtle" https://pod.vardeman.me/vault/meta/profiles/ \
  | grep ldp:contains
# Expected: 5 profile descriptors listed

# 5. Profile descriptor itself
curl -H "Accept: text/turtle" https://pod.vardeman.me/vault/meta/profiles/concept \
  | grep prof:hasResource
# Expected: 200 OK, PROF Profile with hasResource entries

# 6. Link rel=profile on a resource (after MetadataWriter ships)
curl -I https://pod.vardeman.me/vault/wiki/pages/some-concept \
  | grep -i link
# Expected: Link: <…/profiles/concept>; rel="profile"

# 7. List-profiles introspection
curl -i https://pod.vardeman.me/vault/wiki/pages/some-concept?_profile=alt \
  | grep -i link
# Expected: Multiple Link headers with rel=canonical / rel=alternate / format=

# 8. Node.js trusts mkcert root
NODE_EXTRA_CA_CERTS=$(mkcert -CAROOT)/rootCA.pem \
  node -e "https.get('https://pod.vardeman.me/', r => console.log(r.statusCode))"
# Expected: 200 (no TLS error)
```

If all 8 pass: RQ-Substrate-3 is closed, D84/D85/D86 are implemented, and the URI surface is conformant.
