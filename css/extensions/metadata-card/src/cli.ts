#!/usr/bin/env node
// CLI: render a Turtle .meta sidecar to an HTML index card.
//
// Usage:
//   metadata-card sample.ttl
//   metadata-card sample.ttl --out card.html
//   metadata-card sample.ttl --resource http://pod.vardeman.me:3000/vault/.../note.md
//   metadata-card --url http://pod.vardeman.me:3000/vault/.../note.md.meta

import { readFile, writeFile } from "node:fs/promises";
import { parseMeta } from "./parse.js";
import { renderCard } from "./render.js";

interface CliOptions {
  input?: string;
  url?: string;
  out?: string;
  resourceUrl?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);
  if (args.length === 0) {
    console.error(
      "Usage: metadata-card <input.ttl> [--out <file>] [--resource <url>]\n" +
        "       metadata-card --url <pod-meta-url> [--out <file>] [--resource <url>]",
    );
    process.exit(1);
  }
  const opts: CliOptions = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    const next = args[i + 1];
    if (a === "--out" && next) { opts.out = next; i++; }
    else if (a === "--url" && next) { opts.url = next; i++; }
    else if (a === "--resource" && next) { opts.resourceUrl = next; i++; }
    else if (!opts.input && !a.startsWith("--")) { opts.input = a; }
  }
  return opts;
}

async function loadTurtle(opts: CliOptions): Promise<string> {
  if (opts.url) {
    const res = await fetch(opts.url, { headers: { Accept: "text/turtle" } });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${opts.url}`);
    return res.text();
  }
  if (opts.input) {
    return readFile(opts.input, "utf-8");
  }
  throw new Error("No input file or --url provided");
}

async function main() {
  const opts = parseArgs(process.argv);
  const turtle = await loadTurtle(opts);
  const meta = parseMeta(turtle);
  const html = renderCard(meta, { resourceUrl: opts.resourceUrl });
  if (opts.out) {
    await writeFile(opts.out, html, "utf-8");
    console.error(`Wrote ${opts.out}`);
  } else {
    process.stdout.write(html);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
