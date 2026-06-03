// emitMaps.ts — write the committed maps.json sidecar from the live TS constants.
//
// Run via `npm run emit-maps`. Imports the source modules directly (through tsx),
// so it always reflects the current src/, never a stale dist/. The committed
// output is css/extensions/markdown-projection/maps.json; it is consumed by the
// Python agreement tests and the TS agreement tests, and guarded against drift by
// test/mapsSidecar.test.ts.

import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { buildMaps } from "../src/maps.js";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "maps.json");

writeFileSync(out, JSON.stringify(buildMaps(), null, 2) + "\n", "utf8");
console.log(`emit-maps: wrote ${out}`);
