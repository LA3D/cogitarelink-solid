#!/usr/bin/env node
// CLI: render a markdown file to HTML and write the result to stdout (or to
// the path given by --out).
//
// Usage:
//   md-rdfa input.md
//   md-rdfa input.md --out output.html
//   md-rdfa input.md --title "Context Graphs" --pod-base http://pod.vardeman.me:3000

import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { renderMarkdown } from "./render.js";

interface CliOptions {
  input: string;
  out?: string;
  title?: string;
  podBase?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: md-rdfa <input.md> [--out <file>] [--title <title>] [--pod-base <url>]");
    process.exit(1);
  }
  const opts: CliOptions = { input: args[0]! };
  for (let i = 1; i < args.length; i++) {
    const flag = args[i];
    const value = args[i + 1];
    if (flag === "--out" && value) { opts.out = value; i++; }
    else if (flag === "--title" && value) { opts.title = value; i++; }
    else if (flag === "--pod-base" && value) { opts.podBase = value; i++; }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv);
  const source = await readFile(opts.input, "utf-8");
  const title = opts.title ?? basename(opts.input).replace(/\.md$/, "");
  const html = await renderMarkdown(source, { title, podBase: opts.podBase });
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
