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

// Simple debug logger — writes to stderr which CSS captures in docker logs.
// We don't use CSS's getLoggerFor because the @solid/community-server npm
// package doesn't export the logging module in the published dist.
function debug(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.error("[markdown-rdfa]", ...args);
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
    // Build an absolute file:// URL for the ESM render module. At runtime
    // this file lives at dist-cjs/converter.js, so ../dist/render.js points
    // at the compiled ESM pipeline.
    const renderJsPath = path.resolve(__dirname, "..", "dist", "render.js");
    const fileUrl = "file://" + renderJsPath;
    renderMarkdownCache = runtimeImport(fileUrl).then(
      (m) => m.renderMarkdown as RenderMarkdownFn,
    );
  }
  return renderMarkdownCache;
}

export class MarkdownRdfaConverter extends BaseTypedRepresentationConverter {
  private readonly podBase?: string;

  public constructor(podBase?: string) {
    super(TEXT_MARKDOWN, TEXT_HTML);
    this.podBase = podBase;
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
      return new BasicRepresentation(html, representation.metadata, TEXT_HTML);
    } catch (err) {
      debug(`FAILED: ${(err as Error).message}`);
      debug((err as Error).stack ?? "no stack");
      throw err;
    }
  }
}
