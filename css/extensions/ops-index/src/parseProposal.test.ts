import { describe, it, expect } from "vitest";
import { Parser } from "n3";
import { parseProposal } from "./parseProposal.js";

const OP = "https://pod.vardeman.me/id/.operations/p1";
const ttl = (status: string) => `
@prefix as:     <https://www.w3.org/ns/activitystreams#> .
@prefix mem:    <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix schema: <https://schema.org/> .
<${OP}> a mem:RealignAction ;
    as:object <https://pod.vardeman.me/id/schemes/doi> ;
    schema:actionStatus schema:${status} .`;

const quads = (s: string) => new Parser().parse(ttl(s));

describe("parseProposal", () => {
  it("extracts target and Potential status", () => {
    expect(parseProposal(quads("PotentialActionStatus"), OP)).toEqual({
      target: "https://pod.vardeman.me/id/schemes/doi",
      status: "https://schema.org/PotentialActionStatus",
    });
  });
  it("extracts non-Potential status (removal signal)", () => {
    expect(parseProposal(quads("FailedActionStatus"))?.status)
      .toContain("FailedActionStatus");
  });
  it("returns undefined for a non-RealignAction resource", () => {
    const other = new Parser().parse(`<${OP}> <http://purl.org/dc/terms/title> "x" .`);
    expect(parseProposal(other, OP)).toBeUndefined();
  });
});
