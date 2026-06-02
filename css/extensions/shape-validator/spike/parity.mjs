/**
 * Parity check: Zazuko (rdf-validate-shacl) vs shacl-engine
 * on valid and invalid skos:Concept graphs.
 * inference="none" (no entailment engine passed to either validator).
 *
 * Usage: node spike/parity.mjs  (from css/extensions/shape-validator/)
 */

// Use bare package names — node will resolve from node_modules above
import { Store, Parser, Writer } from 'n3';
import SHACLValidator from 'rdf-validate-shacl';
import { Validator as ShaclEngineValidator } from 'shacl-engine';
import rdfDataModel from '@rdfjs/data-model';
import rdfDataset from '@rdfjs/dataset';

// shacl-engine requires a factory with BOTH RDF/JS DataFactory term builders AND dataset().
// @rdfjs/data-model supplies term builders; @rdfjs/dataset supplies dataset().
const combinedFactory = { ...rdfDataModel, dataset: (quads) => rdfDataset.dataset(quads) };

// Minimal ConceptShape: prefLabel required (minCount 1)
const SHAPES_TTL = `
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

<urn:test:ConceptShape> a sh:NodeShape ;
  sh:targetClass skos:Concept ;
  sh:property [ sh:path skos:prefLabel ; sh:minCount 1 ; sh:datatype xsd:string ] .
`;

// Valid: has prefLabel xsd:string
const VALID_TTL = `
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
<urn:test:concept1> a skos:Concept ;
  skos:prefLabel "Test Concept"^^xsd:string .
`;

// Invalid: skos:Concept but no prefLabel at all
const INVALID_TTL = `
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
<urn:test:concept2> a skos:Concept .
`;

function parseN3Store(ttl) {
  const store = new Store();
  store.addQuads(new Parser().parse(ttl));
  return store;
}

function n3StoreToRdfjsDs(store) {
  const ds = rdfDataset.dataset();
  for (const quad of store) ds.add(quad);
  return ds;
}

async function serializeDs(ds) {
  return new Promise((resolve, reject) => {
    const writer = new Writer({ prefixes: { sh: 'http://www.w3.org/ns/shacl#', xsd: 'http://www.w3.org/2001/XMLSchema#' } });
    for (const quad of ds) writer.addQuad(quad);
    writer.end((err, result) => err ? reject(err) : resolve(result));
  });
}

async function runZazuko(shapesStore, dataStore, label) {
  const start = Date.now();
  // inference="none": do NOT pass { factory } that would enable RDFS entailment
  const validator = new SHACLValidator(shapesStore);
  const report = await validator.validate(dataStore);
  const elapsed = Date.now() - start;
  const turtle = await serializeDs(report.dataset);
  return { label, engine: 'zazuko', conforms: report.conforms, elapsed, reportTurtle: turtle };
}

async function runShaclEngine(shapesDs, dataDs, label) {
  const start = Date.now();
  // inference="none": no entailment — combinedFactory (data-model + dataset)
  const validator = new ShaclEngineValidator(shapesDs, { factory: combinedFactory });
  const report = await validator.validate({ dataset: dataDs });
  const elapsed = Date.now() - start;
  const turtle = await serializeDs(report.dataset);
  return { label, engine: 'shacl-engine', conforms: report.conforms, elapsed, reportTurtle: turtle };
}

async function main() {
  console.log('=== shacl-engine parity spike ===\n');

  const shapesN3 = parseN3Store(SHAPES_TTL);
  const validN3  = parseN3Store(VALID_TTL);
  const invalidN3 = parseN3Store(INVALID_TTL);

  const shapesDs  = n3StoreToRdfjsDs(shapesN3);
  const validDs   = n3StoreToRdfjsDs(validN3);
  const invalidDs = n3StoreToRdfjsDs(invalidN3);

  const results = [];
  results.push(await runZazuko(shapesN3, validN3, 'valid'));
  results.push(await runZazuko(shapesN3, invalidN3, 'invalid'));
  results.push(await runShaclEngine(shapesDs, validDs, 'valid'));
  results.push(await runShaclEngine(shapesDs, invalidDs, 'invalid'));

  console.log('Results:');
  for (const r of results) {
    console.log(`  [${r.engine}] ${r.label}: conforms=${r.conforms} (${r.elapsed}ms)`);
  }

  console.log('\nParity:');
  let allMatch = true;
  for (const label of ['valid', 'invalid']) {
    const z = results.find(r => r.engine === 'zazuko' && r.label === label);
    const e = results.find(r => r.engine === 'shacl-engine' && r.label === label);
    const match = z.conforms === e.conforms;
    if (!match) allMatch = false;
    console.log(`  ${label}: zazuko=${z.conforms}, shacl-engine=${e.conforms} -> ${match ? 'MATCH' : 'DIVERGE'}`);
  }
  console.log(`\nVerdict: ${allMatch ? 'VERDICTS MATCH' : 'VERDICTS DIVERGE'}`);

  // Show invalid reports
  const zi = results.find(r => r.engine === 'zazuko' && r.label === 'invalid');
  const ei = results.find(r => r.engine === 'shacl-engine' && r.label === 'invalid');
  console.log('\n--- Zazuko invalid report ---');
  console.log(zi.reportTurtle);
  console.log('--- shacl-engine invalid report ---');
  console.log(ei.reportTurtle);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
