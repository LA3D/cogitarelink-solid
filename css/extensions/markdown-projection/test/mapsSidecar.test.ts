// Maps-sidecar drift guard (R-T7, audit R3).
//
// maps.json is the committed cross-mirror sidecar: the Python agreement tests and
// the other TS agreement tests read it instead of scraping TS source (closes
// F8-python). It MUST stay in lockstep with the live TS constants. This test
// rebuilds the sidecar from source (buildMaps) and asserts deep equality with the
// committed JSON — so a constant edit that forgets `npm run emit-maps` fails CI
// rather than silently shipping a stale sidecar.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildMaps } from "../src/maps.js";

const MAPS_JSON = join(__dirname, "..", "maps.json");

describe("maps.json sidecar drift guard", () => {
    it("committed maps.json deep-equals the live TS maps (run `npm run emit-maps`)", () => {
        const committed = JSON.parse(readFileSync(MAPS_JSON, "utf8"));
        expect(committed).toEqual(buildMaps());
    });
});
