// Render a parsed ResourceMeta as an HTML "index card" — a self-contained
// page that summarises a Solid Pod resource for human consumption when no
// content-type-specific converter is available.
//
// This is the FALLBACK converter (Sample B). For markdown resources we'd
// prefer the markdown-rdfa Sample A pipeline; for arbitrary file types
// (PDFs, office docs, datasets, binaries we don't otherwise know how to
// preview) the metadata card is the human view.

import type { ResourceMeta, Relationship } from "./parse.js";

const STYLE = `
  :root {
    color-scheme: light dark;
    --bg: Canvas;
    --fg: CanvasText;
    --muted: GrayText;
    --accent: LinkText;
    --border: color-mix(in srgb, CanvasText 15%, transparent);
    --code-bg: color-mix(in srgb, CanvasText 6%, transparent);
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    line-height: 1.5;
    max-width: 48rem;
    margin: 2rem auto;
    padding: 0 1rem;
    color: var(--fg);
    background: var(--bg);
  }
  header { border-bottom: 1px solid var(--border); padding-bottom: 1rem; margin-bottom: 1.5rem; }
  h1 { font-size: 1.5rem; margin: 0 0 0.5rem 0; }
  .types { color: var(--muted); font-size: 0.875rem; }
  .types code { font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; }
  .description { font-size: 1rem; margin: 1rem 0; }
  .field { display: grid; grid-template-columns: 9rem 1fr; gap: 0.5rem 1rem; margin: 0.25rem 0; font-size: 0.9rem; }
  .field dt { color: var(--muted); margin: 0; }
  .field dd { margin: 0; word-break: break-word; }
  .field code { background: var(--code-bg); padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.875rem; }
  section { margin: 2rem 0; }
  section h2 { font-size: 1.1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.25rem; }
  .relationships ul { padding-left: 1.25rem; }
  .relationships .label { color: var(--muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .download {
    display: inline-block;
    padding: 0.5rem 1rem;
    background: var(--accent);
    color: var(--bg);
    text-decoration: none;
    border-radius: 6px;
    margin-top: 1rem;
  }
  .download:hover { opacity: 0.85; }
  .triples { font-size: 0.8rem; color: var(--muted); }
  .triples table { width: 100%; border-collapse: collapse; }
  .triples td { padding: 0.25rem 0.5rem; vertical-align: top; border-top: 1px solid var(--border); }
  .triples td:first-child { white-space: nowrap; max-width: 18rem; overflow: hidden; text-overflow: ellipsis; }
  details summary { cursor: pointer; color: var(--muted); }
`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderValue(value: string, isIri: boolean): string {
  const safe = escapeHtml(value);
  if (isIri && (value.startsWith("http://") || value.startsWith("https://"))) {
    return `<a href="${safe}">${safe}</a>`;
  }
  return isIri ? `<code>${safe}</code>` : safe;
}

function formatBytes(s: string): string {
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function shortenIri(iri: string): string {
  // Show the local name (after # or last /) for compactness in the predicate
  // column of the "all triples" table.
  const hashIdx = iri.lastIndexOf("#");
  if (hashIdx >= 0) return iri.slice(hashIdx + 1);
  const slashIdx = iri.lastIndexOf("/");
  if (slashIdx >= 0) return iri.slice(slashIdx + 1);
  return iri;
}

function renderRelationships(rels: Relationship[]): string {
  if (rels.length === 0) {
    return `<p class="muted">No typed relationships in <code>.meta</code>.</p>`;
  }
  // Group by label so the same label doesn't repeat.
  const groups = new Map<string, Relationship[]>();
  for (const r of rels) {
    const list = groups.get(r.label) ?? [];
    list.push(r);
    groups.set(r.label, list);
  }
  const items = [...groups.entries()]
    .map(([label, list]) => {
      const lis = list
        .map((r) => `<li>${renderValue(r.target, r.isIri)}</li>`)
        .join("\n        ");
      return `    <div>
      <div class="label">${escapeHtml(label)}</div>
      <ul>
        ${lis}
      </ul>
    </div>`;
    })
    .join("\n");
  return items;
}

function renderField(label: string, value: string | null, isIri: boolean = false): string {
  if (!value) return "";
  return `    <div class="field"><dt>${escapeHtml(label)}</dt><dd>${renderValue(value, isIri)}</dd></div>`;
}

export interface CardOptions {
  // URL of the underlying resource. If omitted, taken from meta.subject.
  resourceUrl?: string;
  // If false, suppress the download/open button (e.g. when this is the
  // canonical view for a resource that has no separate body).
  showResourceLink?: boolean;
}

export function renderCard(meta: ResourceMeta, opts: CardOptions = {}): string {
  const url = opts.resourceUrl ?? meta.subject;
  const showLink = opts.showResourceLink ?? true;
  const title = meta.title ?? meta.subject;
  const types = meta.types
    .map((t) => `<code>${escapeHtml(shortenIri(t))}</code>`)
    .join(", ");

  const fields = [
    renderField("Format", meta.format),
    renderField("Size", meta.size ? formatBytes(meta.size) : null),
    renderField("Created", meta.created),
    renderField("Modified", meta.modified),
    renderField("Contributor", meta.contributor, true),
    renderField("Source", meta.source, true),
  ]
    .filter(Boolean)
    .join("\n");

  const relationships = renderRelationships(meta.relationships);

  const triplesRows = meta.otherTriples
    .map(
      (t) =>
        `      <tr><td><code title="${escapeHtml(t.predicate)}">${escapeHtml(shortenIri(t.predicate))}</code></td><td>${renderValue(t.object, t.isIri)}</td></tr>`,
    )
    .join("\n");

  const triplesSection =
    meta.otherTriples.length > 0
      ? `
  <section class="triples">
    <details>
      <summary>All other triples (${meta.otherTriples.length})</summary>
      <table>
${triplesRows}
      </table>
    </details>
  </section>`
      : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="generator" content="metadata-card (cogitarelink-solid)">
  <style>${STYLE}</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    ${types ? `<div class="types">${types}</div>` : ""}
    ${meta.description ? `<p class="description">${escapeHtml(meta.description)}</p>` : ""}
  </header>

  <section class="metadata">
    <h2>Metadata</h2>
    <dl>
${fields || `    <div class="field"><dt>Subject</dt><dd><code>${escapeHtml(meta.subject)}</code></dd></div>`}
    </dl>
  </section>

  <section class="relationships">
    <h2>Relationships</h2>
${relationships}
  </section>${triplesSection}

  ${showLink ? `<a class="download" href="${escapeHtml(url)}">Open underlying resource</a>` : ""}
</body>
</html>
`;
}
