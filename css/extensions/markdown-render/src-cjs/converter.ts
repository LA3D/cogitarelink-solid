// CJS wrapper that lets CSS's Components.js `require()` our converter class,
// while the actual rendering pipeline (unified/remark/rehype, ESM-only) is
// loaded lazily via a runtime dynamic import.
//
// Why this layering exists:
// - Components.js v6 uses ConstructionStrategyCommonJs.ts which calls Node's
//   `require()` directly — it has no ESM loader. The class file we point it
//   at MUST be CommonJS-loadable (`.js` extension resolved as CJS).
// - The upstream unified/remark/rehype ecosystem has been ESM-only since v10+.
// - Solution: a CJS wrapper that uses an eval-wrapped `import()` to load the
//   ESM pipeline at request time. Without the eval wrapper, TypeScript's
//   `module: CommonJS` setting would transpile `import()` into a synchronous
//   `require()` — which fails with `ERR_REQUIRE_ESM` on ESM-only packages.
// - `dist-cjs/package.json` declares `"type": "commonjs"` so Node interprets
//   `dist-cjs/converter.js` as CommonJS regardless of the parent package's
//   `"type": "module"` setting.

import { readableToString } from "@solid/community-server/dist/util/StreamUtil";
import { BasicRepresentation } from "@solid/community-server/dist/http/representation/BasicRepresentation";
import { BaseTypedRepresentationConverter } from "@solid/community-server/dist/storage/conversion/BaseTypedRepresentationConverter";
import type { Representation } from "@solid/community-server/dist/http/representation/Representation";
import type { RepresentationConverterArgs } from "@solid/community-server/dist/storage/conversion/RepresentationConverter";
import * as path from "path";
import { JsonLdScriptInjector } from "./JsonLdScriptInjector";

// Simple debug logger — writes to stderr which CSS captures in docker logs.
// We don't use CSS's getLoggerFor because the @solid/community-server npm
// package doesn't export the logging module in the published dist.
function debug(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.error("[markdown-render]", ...args);
}

const TEXT_MARKDOWN = "text/markdown";
const TEXT_HTML = "text/html";

// Function type declared inline so componentsjs-generator doesn't try to
// walk the signature across module boundaries (it can't handle function
// exports from other modules — only classes/interfaces).
type RenderMarkdownFn = (
  source: string,
  opts?: { podBase?: string; title?: string },
) => Promise<string>;

// Hide dynamic import from TypeScript's CJS compiler. With `module: CommonJS`,
// a literal `import(...)` expression gets transpiled into `Promise.resolve()
// .then(() => require(...))`, which defeats the purpose (require() can't load
// ESM modules). Wrapping the import in `new Function()` constructs the
// function fresh at runtime from a string, so TypeScript never sees it as a
// call it should transpile.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runtimeImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<any>;

// Cached promise so repeated requests don't re-import the ESM pipeline.
let renderMarkdownCache: Promise<RenderMarkdownFn> | null = null;

function getRenderMarkdown(): Promise<RenderMarkdownFn> {
  if (renderMarkdownCache === null) {
    // Build an absolute file:// URL for the ESM render module. The ESM build
    // uses tsconfig rootDir=../.. so output paths preserve the rooted-from-
    // parent structure: src/render.ts compiles to
    // dist/extensions/markdown-render/src/render.js (not dist/render.js).
    // At runtime this file lives at dist-cjs/converter.js, so we navigate
    // up to extension root, then into the nested ESM output path.
    const renderJsPath = path.resolve(
      __dirname,
      "..",
      "dist",
      "extensions",
      "markdown-render",
      "src",
      "render.js",
    );
    const fileUrl = "file://" + renderJsPath;
    renderMarkdownCache = runtimeImport(fileUrl).then(
      (m) => m.renderMarkdown as RenderMarkdownFn,
    );
  }
  return renderMarkdownCache;
}

export class MarkdownRdfaConverter extends BaseTypedRepresentationConverter {
  private readonly podBase?: string;
  private readonly injector: JsonLdScriptInjector;

  public constructor(podBase?: string) {
    super(TEXT_MARKDOWN, TEXT_HTML);
    this.podBase = podBase;
    this.injector = new JsonLdScriptInjector();
    debug(`initialised (podBase=${podBase ?? "none"})`);
  }

  public async handle({ representation, identifier }: RepresentationConverterArgs): Promise<Representation> {
    debug(`handle() called for ${identifier.path}`);
    try {
      const markdown = await readableToString(representation.data);
      debug(`read ${markdown.length} bytes of markdown`);
      const renderMarkdown = await getRenderMarkdown();
      debug(`renderMarkdown loaded`);
      const html = await renderMarkdown(markdown, { podBase: this.podBase });
      debug(`rendered ${html.length} bytes of HTML`);

      const enriched = this.injectJsonLd(html, identifier.path, representation.metadata);
      return new BasicRepresentation(enriched, representation.metadata, TEXT_HTML);
    } catch (err) {
      debug(`FAILED: ${(err as Error).message}`);
      debug((err as Error).stack ?? "no stack");
      throw err;
    }
  }

  // Inject a <script type="application/ld+json"> block carrying the
  // resource's .meta-derived triples into the rendered HTML. The .meta
  // triples are already present on representation.metadata — CSS's
  // FileDataAccessor.getRawMetadata() parses the .meta Turtle and adds the
  // quads at request time. Subject filter inside the injector keeps only
  // triples whose subject = the resource IRI.
  //
  // Injection point:
  //   - before </head> when the rehype-document <head> is present (always
  //     the case when renderMarkdown wraps in rehype-document, which it
  //     does by default)
  //   - falls back to before </body> if </head> isn't found
  //   - falls back to appending at the end of the string if neither is
  //     present (e.g. fragment renders)
  //
  // Empty-metadata case: injector returns "" and the HTML is returned
  // unchanged. Idempotence: the marker substring already-injected check
  // guards against double-emit if the converter is re-invoked.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private injectJsonLd(html: string, resourceIri: string, metadata: any): string {
    let quads: unknown;
    try {
      quads = typeof metadata?.quads === "function" ? metadata.quads() : [];
    } catch (err) {
      debug(`metadata.quads() threw: ${(err as Error).message}`);
      return html;
    }
    if (!Array.isArray(quads) || quads.length === 0) return html;

    // Idempotence: if some prior pass already injected a JSON-LD script,
    // do not double-emit. (renderMarkdown's <head> never contains this.)
    if (html.includes('<script type="application/ld+json">')) {
      debug(`JSON-LD <script> already present, skipping injection`);
      return html;
    }

    const scriptTag = this.injector.buildScriptTag(resourceIri, quads as never);
    if (scriptTag.length === 0) {
      debug(`no triples for ${resourceIri}, skipping injection`);
      return html;
    }

    const insertion = `${scriptTag}\n`;
    const headClose = html.lastIndexOf("</head>");
    if (headClose !== -1) {
      debug(`injecting ${scriptTag.length} bytes of JSON-LD before </head>`);
      return html.slice(0, headClose) + insertion + html.slice(headClose);
    }
    const bodyClose = html.lastIndexOf("</body>");
    if (bodyClose !== -1) {
      debug(`no </head>, injecting JSON-LD before </body>`);
      return html.slice(0, bodyClose) + insertion + html.slice(bodyClose);
    }
    debug(`no </head> or </body>, appending JSON-LD at end`);
    return html + "\n" + insertion;
  }
}
