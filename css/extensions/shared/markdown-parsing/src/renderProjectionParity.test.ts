// Render ≡ projection token-set parity (audit R5 / R-T3, task requirement 3).
//
// The structural defect R-T3 closes: render and projection used DIFFERENT parse
// machinery, so the same wikilink/span syntax could project (graph view) while
// rendering inert (document view), or vice versa. This test runs each
// pathological body through BOTH paths and asserts the wikilink TARGET SETS are
// identical:
//   - RENDER path: the real remarkTypedWikilinks plugin (same as render.ts), run
//     over the same remark-parse + GFM + frontmatter transform chain render uses;
//     we collect the `data-target` of every <link> node it splices in.
//   - PROJECTION path: extractWikilinks (the function MarkdownProjectionListener
//     calls).
// If the two ever disagree, the dual-view "document view and graph view agree"
// claim (Verborgh, D109) is structurally broken — which is exactly what R-T3 fixes.
import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { visit } from "unist-util-visit";
import type { Link } from "mdast";
import { extractWikilinks, remarkTypedWikilinks } from "./wikilinks.js";
import type { WikilinkResolver } from "./resolver.js";

// Minimal resolver: identity-ish, just needs to not throw. The targets we compare
// come from `data-target` (the raw wikilink target), not the resolved URL.
const resolver: WikilinkResolver = { resolve: () => "http://x/" };

// Run the FULL render transform chain (the same plugins render.ts uses) then read
// back every wikilink the render plugin emitted, by its data-target.
async function renderTargets(body: string): Promise<string[]> {
  const file = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkGfm)
    .use(remarkTypedWikilinks, { resolver });
  const tree = file.parse(body);
  const ran = await file.run(tree);
  const out: string[] = [];
  visit(ran, "link", (node: Link) => {
    const dt = (node.data?.hProperties as Record<string, unknown> | undefined)?.["data-target"];
    if (typeof dt === "string") out.push(dt);
  });
  return out;
}

const projectionTargets = (body: string) => extractWikilinks(body).map((r) => r.title);

const PATHOLOGICAL: Array<[string, string]> = [
  ["plain paragraph", "see [[Context Graphs]] and [[RLM]]{.related}"],
  ["indented code", "para [[Live]]{.broader}\n\n    [[Z]]{.broader}\n\nafter"],
  ["fenced code", "a\n```\n[[Z]]{.broader}\n```\nb [[W]]{.broader}"],
  ["4-backtick fence", "a [[W]]{.broader}\n\n````\n[[Z]]{.broader} ```\n````"],
  ["inline code", "real [[A]]{.broader} but `code [[B]]{.broader}`"],
  ["fence in blockquote", "> ```\n> [[Z]]{.broader}\n> ```\n>\n> quoted [[W]]{.related} prose"],
  ["link destination", "[t](http://x/[[N]]) and [[M]]{.broader}"],
  ["autolink literal", "see http://example.com/[[N]]{.broader} and [[Real]]{.broader}"],
  ["html block", "<div>\n[[Z]]{.broader}\n</div>\n\n[[W]]{.broader}"],
  ["list items", "- [[Alpha]]{.broader}\n- [[Beta]]{.related}"],
  ["alias form", "[[Context Graphs|context graph theory]]{.related}"],
];

describe("render ≡ projection wikilink token-set parity", () => {
  for (const [name, body] of PATHOLOGICAL) {
    it(`agrees on token set: ${name}`, async () => {
      const render = (await renderTargets(body)).sort();
      const projection = projectionTargets(body).sort();
      expect(projection).toEqual(render);
    });
  }
});
