/**
 * Offline boot-config guard — kills the "Invalid predicate IRI" boot-failure class.
 *
 * This class has bitten the repo three times. The mechanism: at boot, Components.js
 * JSON-LD-parses every config in css/config/ with a STRICT parser (strictValues:true).
 * A config term (e.g. storagePath) that the owning @type's type-scoped @context does
 * not map throws `Invalid predicate IRI: <term>` and the server never starts. The
 * public @context URLs resolve LOCALLY via each extension's package.json `lsd:contexts`
 * map. The most recent bite: solid-config.json passed `storagePath` to the
 * MarkdownRdfaConverter whose generated context.jsonld lacked the term — caught only by
 * a full Docker `make reset`.
 *
 * This guard parses every css/config config the SAME WAY boot does — same library
 * (componentsjs RdfParser → jsonld-streaming-parser with strictValues:true), same
 * documentLoader wiring (PrefetchedDocumentLoader fed from lsd:contexts) — but offline,
 * in milliseconds, in `npm test`.
 *
 * Loader design (mirrors componentsjs ConfigRegistry + ModuleStateBuilder):
 *   - contexts:   {public context URL -> parsed context object}, harvested from the
 *                 `lsd:contexts` of every extension package.json plus the three base
 *                 packages whose contexts the configs reference but that ship inside
 *                 node_modules (CSS, asynchronous-handlers, componentsjs). The
 *                 componentsjs base context (^6.0.0 + back-versions) is auto-registered
 *                 by RdfParser's PrefetchedDocumentLoader, so we don't add it by hand.
 *   - importPaths:{bundle IRI prefix -> absolute local dir}, harvested from
 *                 `lsd:importPaths`. These are LOAD-BEARING: they let the type-scoped
 *                 contexts (StaticStorageDescriber.jsonld#..., ParallelHandler.jsonld#...)
 *                 resolve, exactly as at boot. Without them the strict parser
 *                 false-positives on every config that uses a typed handler/array term.
 *   - parse opts: ignoreImports:true (we iterate every file ourselves rather than chase
 *                 rdfs:seeAlso/import to siblings), skipContextValidation:true and
 *                 remoteContextLookups:false (offline) — the ConfigRegistry boot defaults.
 *
 * Version tolerance: lsd context maps observed in this repo are exact-URL; componentsjs
 * itself maps its bundle by major version and the PrefetchedDocumentLoader back-fills
 * older majors, so no manual version stripping is needed. If an extension's dist/ isn't
 * built (its context.jsonld is missing on disk) we record it; any config that references
 * an unbuilt context then fails LOUDLY with an actionable message (never a vacuous pass).
 */
import { describe, it, expect } from "vitest";
import { promises as fs, createReadStream } from "fs";
import { Readable } from "stream";
import { join, relative } from "path";
import { RdfParser } from "componentsjs";
import { ModuleStateBuilder } from "componentsjs/lib/loading/ModuleStateBuilder";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const CONFIG_DIR = join(REPO_ROOT, "css", "config");
const EXT_DIR = join(REPO_ROOT, "css", "extensions");
// Base packages whose contexts the configs reference but that live in node_modules
// rather than css/extensions. shape-validator's node_modules carries all three.
const SV_NODE_MODULES = join(__dirname, "..", "node_modules");
const BASE_PKGS = ["@solid/community-server", "asynchronous-handlers", "componentsjs"];

type ModuleState = {
  contexts: Record<string, unknown>;
  importPaths: Record<string, string>;
  missingContextUrls: string[];
};

async function readJson(path: string): Promise<any> {
  return JSON.parse(await fs.readFile(path, "utf8"));
}

async function exists(path: string): Promise<boolean> {
  try {
    await fs.stat(path);
    return true;
  } catch {
    return false;
  }
}

// Collect the {moduleDir -> package.json} hash that ModuleStateBuilder consumes.
async function collectPackageJsons(): Promise<Record<string, any>> {
  const out: Record<string, any> = {};
  const add = async (dir: string) => {
    const pjPath = join(dir, "package.json");
    if (await exists(pjPath)) out[dir] = await readJson(pjPath);
  };
  for (const ent of await fs.readdir(EXT_DIR, { withFileTypes: true })) {
    if (ent.isDirectory()) await add(join(EXT_DIR, ent.name));
  }
  for (const p of BASE_PKGS) await add(join(SV_NODE_MODULES, p));
  return out;
}

// Build the contexts + importPaths exactly as boot does, but tolerate an extension
// whose dist/ context.jsonld hasn't been built yet (record it instead of throwing).
async function buildModuleState(): Promise<ModuleState> {
  const packageJsons = await collectPackageJsons();

  // contexts: replicate ModuleStateBuilder.buildComponentContexts, but skip-and-record
  // missing files so a fresh (unbuilt) checkout fails loudly per-config, not on setup.
  const contexts: Record<string, unknown> = {};
  const missingContextUrls: string[] = [];
  for (const [moduleDir, pkg] of Object.entries(packageJsons)) {
    const ctxs = pkg["lsd:contexts"] as Record<string, string> | undefined;
    if (!ctxs) continue;
    for (const [url, rel] of Object.entries(ctxs)) {
      const fp = join(moduleDir, rel);
      if (await exists(fp)) contexts[url] = await readJson(fp);
      else missingContextUrls.push(url);
    }
  }

  // importPaths: use the real builder (it validates dirs exist). Filter out any package
  // whose import-path target dir is missing so the builder doesn't throw on a fresh tree.
  const builderInput: Record<string, any> = {};
  for (const [moduleDir, pkg] of Object.entries(packageJsons)) {
    const ip = pkg["lsd:importPaths"] as Record<string, string> | undefined;
    if (!ip) {
      builderInput[moduleDir] = pkg;
      continue;
    }
    const filtered: Record<string, string> = {};
    for (const [k, v] of Object.entries(ip)) {
      if (await exists(join(moduleDir, v))) filtered[k] = v;
    }
    builderInput[moduleDir] = { ...pkg, "lsd:importPaths": filtered };
  }
  const importPaths = await new ModuleStateBuilder().buildComponentImportPaths(builderInput);

  return { contexts, importPaths, missingContextUrls };
}

// Parse one config the boot way; resolve to the list of parser error messages (empty = clean).
function parseConfig(
  source: Readable,
  path: string,
  state: ModuleState,
): Promise<string[]> {
  return new Promise((resolve) => {
    const errors: string[] = [];
    const quadStream = new RdfParser().parse(source, {
      path, // RdfParser infers contentType from the .json extension, as boot does
      contexts: state.contexts,
      importPaths: state.importPaths,
      ignoreImports: true, // we iterate every file ourselves
      skipContextValidation: true,
      remoteContextLookups: false,
    } as any);
    const timer = setTimeout(() => resolve([...errors, "__TIMEOUT__"]), 15000);
    quadStream.on("data", () => {
      /* count nothing; we only care about errors + completion */
    });
    quadStream.on("error", (e: Error) => {
      errors.push(e.message);
      clearTimeout(timer);
      resolve(errors);
    });
    quadStream.on("end", () => {
      clearTimeout(timer);
      resolve(errors);
    });
  });
}

// Same, but also count emitted quads (used by the non-vacuity self-check).
function parseConfigCounting(
  source: Readable,
  path: string,
  state: ModuleState,
): Promise<{ errors: string[]; quads: number }> {
  return new Promise((resolve) => {
    const errors: string[] = [];
    let quads = 0;
    const quadStream = new RdfParser().parse(source, {
      path,
      contexts: state.contexts,
      importPaths: state.importPaths,
      ignoreImports: true,
      skipContextValidation: true,
      remoteContextLookups: false,
    } as any);
    const timer = setTimeout(
      () => resolve({ errors: [...errors, "__TIMEOUT__"], quads }),
      15000,
    );
    quadStream.on("data", () => {
      quads++;
    });
    quadStream.on("error", (e: Error) => {
      errors.push(e.message);
      clearTimeout(timer);
      resolve({ errors, quads });
    });
    quadStream.on("end", () => {
      clearTimeout(timer);
      resolve({ errors, quads });
    });
  });
}

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
// Built-in componentsjs object-oriented vocabulary (Override, OverrideListInsert*, ...).
// These are not component descriptors; they're resolved by componentsjs itself.
const OO_VOCAB = "https://linkedsoftwaredependencies.org/vocabularies/object-oriented#";

// Collect the rdf:type object IRIs the parser emits for one config (the @type values,
// fully expanded by the same context the parser uses). Errors are ignored here — the
// term-guard test already asserts clean parsing; this just harvests types.
function collectTypeIris(
  source: Readable,
  path: string,
  state: ModuleState,
): Promise<Set<string>> {
  return new Promise((resolve) => {
    const types = new Set<string>();
    const quadStream = new RdfParser().parse(source, {
      path,
      contexts: state.contexts,
      importPaths: state.importPaths,
      ignoreImports: true,
      skipContextValidation: true,
      remoteContextLookups: false,
    } as any);
    const timer = setTimeout(() => resolve(types), 15000);
    quadStream.on("data", (q: any) => {
      if (q.predicate.value === RDF_TYPE) types.add(q.object.value);
    });
    quadStream.on("error", () => {
      clearTimeout(timer);
      resolve(types);
    });
    quadStream.on("end", () => {
      clearTimeout(timer);
      resolve(types);
    });
  });
}

// Strip the `/^X.Y.Z/` semver-range segment from a bundle IRI so the generator's
// ^0.0.0-stamped type IRIs match the package's ^0.1.0 lsd:importPaths prefixes.
const stripVersionRange = (s: string): string => s.replace(/\/\^\d+\.\d+\.\d+\//u, "/");

// Resolve a component IRI base (the part before #) to a local descriptor file via
// version-tolerant importPath matching. Returns null when no importPath covers it.
function resolveComponentFile(base: string, state: ModuleState): string | null {
  const b = stripVersionRange(base);
  for (const [prefix, dir] of Object.entries(state.importPaths)) {
    const p = stripVersionRange(prefix);
    if (b.startsWith(p)) return join(dir, b.slice(p.length));
  }
  return null;
}

// True iff the descriptor file declares a node whose @id fragment is exactly `frag`.
async function fileDeclaresFragment(file: string, frag: string): Promise<boolean> {
  let doc: unknown;
  try {
    doc = await readJson(file);
  } catch {
    return false;
  }
  let found = false;
  const visit = (o: unknown) => {
    if (found) return;
    if (Array.isArray(o)) {
      for (const x of o) visit(x);
    } else if (o && typeof o === "object") {
      const id = (o as Record<string, unknown>)["@id"];
      if (typeof id === "string" && id.split("#")[1] === frag) {
        found = true;
        return;
      }
      for (const v of Object.values(o as Record<string, unknown>)) visit(v);
    }
  };
  visit(doc);
  return found;
}

async function findConfigFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
    const fp = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await findConfigFiles(fp)));
    else if (ent.name.endsWith(".json")) out.push(fp);
  }
  return out;
}

// A Components.js config is a JSON object with an @context. css/config also holds the
// account-seed file (seed.json: a bare array, no @context) which boot loads via a
// different (--seedConfig) mechanism, not the Components.js parser — skip those.
function isComponentsConfig(parsed: unknown): boolean {
  return (
    !!parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    "@context" in (parsed as Record<string, unknown>)
  );
}

describe("config guard: offline JSON-LD parse of css/config vs lsd:contexts", () => {
  it("builds a non-empty contexts map with the load-bearing extension + base contexts", async () => {
    const state = await buildModuleState();
    // Sanity: the markdown-render context (the historical-bug site) and the CSS base
    // context must be present, or the guard would be parsing against the wrong loader.
    const urls = Object.keys(state.contexts);
    expect(
      urls.some((u) => u.includes("markdown-render")),
      "markdown-render context absent — run `npm run build` in css/extensions/markdown-render",
    ).toBe(true);
    expect(
      urls.some((u) => u.includes("@solid/community-server")),
      "CSS base context absent",
    ).toBe(true);
    expect(
      urls.some((u) => u.includes("asynchronous-handlers")),
      "asynchronous-handlers base context absent",
    ).toBe(true);
    // importPaths must be populated, else type-scoped terms (handlers, terms, ...)
    // would false-positive.
    expect(Object.keys(state.importPaths).length).toBeGreaterThan(0);
  });

  it("parses every Components.js config with zero Invalid-predicate-IRI / strict errors", async () => {
    const state = await buildModuleState();
    const files = (await findConfigFiles(CONFIG_DIR)).sort();
    const failures: string[] = [];
    let parsedCount = 0;

    for (const file of files) {
      const rel = relative(REPO_ROOT, file);
      let parsed: unknown;
      try {
        parsed = await readJson(file);
      } catch (e) {
        failures.push(`${rel}: not valid JSON — ${(e as Error).message}`);
        continue;
      }
      if (!isComponentsConfig(parsed)) continue; // non-config (e.g. seed.json)

      parsedCount++;
      const errors = await parseConfig(createReadStream(file), file, state);
      if (errors.length) {
        // The parser error already carries the file + offending term, e.g.
        // `Error while parsing file "...": Invalid predicate IRI: storagePath`.
        failures.push(`${rel}: ${errors.join("; ")}`);
      }
    }

    expect(parsedCount, "no Components.js configs were discovered").toBeGreaterThan(0);
    expect(
      failures,
      `config(s) would fail Components.js boot:\n  ${failures.join("\n  ")}`,
    ).toEqual([]);
  });

  it("NEGATIVE CONTROL: an unmapped term on a known @type errors with Invalid predicate IRI (loader is non-vacuous)", async () => {
    const state = await buildModuleState();
    // MarkdownRdfaConverter is a real @type whose context maps podBase + storagePath.
    // `bogusUnmappedTerm` is mapped nowhere => strictValues must reject it.
    const bad = JSON.stringify({
      "@context": [
        "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^8.0.0/components/context.jsonld",
        "https://linkedsoftwaredependencies.org/bundles/npm/markdown-render/^0.1.0/components/context.jsonld",
      ],
      "@graph": [
        {
          "@id": "urn:test:neg",
          "@type": "MarkdownRdfaConverter",
          bogusUnmappedTerm: "value",
        },
      ],
    });
    const errors = await parseConfig(
      Readable.from([bad]),
      join(CONFIG_DIR, "__neg_control__.json"),
      state,
    );
    expect(errors.length, "negative control produced no error — loader wiring is broken").toBeGreaterThan(0);
    expect(errors.join("\n")).toContain("Invalid predicate IRI");
    expect(errors.join("\n")).toContain("bogusUnmappedTerm");
  });

  it("POSITIVE CONTROL: the same @type WITH a mapped term parses cleanly and emits quads", async () => {
    const state = await buildModuleState();
    // storagePath IS mapped on MarkdownRdfaConverter — this is the term whose ABSENCE
    // caused the most recent boot failure. Proves the loader doesn't reject everything.
    const good = JSON.stringify({
      "@context": [
        "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^8.0.0/components/context.jsonld",
        "https://linkedsoftwaredependencies.org/bundles/npm/markdown-render/^0.1.0/components/context.jsonld",
      ],
      "@graph": [
        {
          "@id": "urn:test:pos",
          "@type": "MarkdownRdfaConverter",
          storagePath: "/vault",
        },
      ],
    });
    const { errors, quads } = await parseConfigCounting(
      Readable.from([good]),
      join(CONFIG_DIR, "__pos_control__.json"),
      state,
    );
    expect(errors, `positive control should parse clean: ${errors.join("; ")}`).toEqual([]);
    expect(quads, "positive control emitted no quads — loader is vacuous").toBeGreaterThan(0);
  });

  // STRETCH: every config @type must resolve to a declared component descriptor. This
  // catches the Task-10 "requireElement resolves to undefined" class — a config naming a
  // @type whose component .jsonld was never generated (or was renamed) boots, then crashes
  // at instantiation. Resolution is version-tolerant (the generator stamps ^0.0.0 on type
  // IRIs while lsd:importPaths carry ^0.1.0). Built-in oo: vocabulary types (Override, ...)
  // are componentsjs-resolved, not descriptors, so they're allow-listed.
  it("STRETCH: every config @type resolves to a declared component descriptor", async () => {
    const state = await buildModuleState();
    const files = (await findConfigFiles(CONFIG_DIR)).sort();
    const typeIris = new Set<string>();

    for (const file of files) {
      let parsed: unknown;
      try {
        parsed = await readJson(file);
      } catch {
        continue;
      }
      if (!isComponentsConfig(parsed)) continue;
      for (const t of await collectTypeIris(createReadStream(file), file, state)) {
        typeIris.add(t);
      }
    }

    expect(typeIris.size, "no @type IRIs were harvested").toBeGreaterThan(0);

    const unresolved: string[] = [];
    for (const iri of [...typeIris].sort()) {
      if (iri.startsWith(OO_VOCAB)) continue; // built-in object-oriented vocabulary
      const [base, frag] = iri.split("#");
      if (!frag) {
        unresolved.push(`${iri} (no fragment)`);
        continue;
      }
      const file = resolveComponentFile(base, state);
      if (!file) {
        unresolved.push(`${iri} (no lsd:importPath covers this bundle IRI)`);
        continue;
      }
      if (!(await fileDeclaresFragment(file, frag))) {
        unresolved.push(`${iri} (descriptor file ${relative(REPO_ROOT, file)} does not declare #${frag})`);
      }
    }

    expect(
      unresolved,
      `config @type(s) resolve to no component descriptor (would crash at instantiation):\n  ${unresolved.join("\n  ")}`,
    ).toEqual([]);
  });
});
