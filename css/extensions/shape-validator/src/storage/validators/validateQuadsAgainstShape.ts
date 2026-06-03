import SHACLValidator from 'rdf-validate-shacl';
import type { Store, Quad } from 'n3';
import { Writer } from 'n3';

export interface GraphValidationResult {
  conforms: boolean;
  reportTurtle?: string;
}

// Mirror the Writer config from ShaclValidator.serializeReport so the report
// body is byte-for-byte identical on the existing RDF-body path.
function serialize(dataset: Iterable<Quad>): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const writer = new Writer({
      prefixes: {
        sh: 'http://www.w3.org/ns/shacl#',
        xsd: 'http://www.w3.org/2001/XMLSchema#',
      },
    });
    for (const quad of dataset) {
      writer.addQuad(quad);
    }
    writer.end((err: Error | null, result: string) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

// Validate a data graph against a shapes graph.
// Pure: no HTTP, no store access, no throw — the caller decides what a
// non-conforming result means (the floor throws ShaclValidationError;
// handle() delegates to invokeHookAndThrow).
export async function validateQuadsAgainstShape(
  dataStore: Store,
  shapeStore: Store,
): Promise<GraphValidationResult> {
  const validator = new SHACLValidator(shapeStore);
  const report = await validator.validate(dataStore);
  if (report.conforms) return { conforms: true };
  return { conforms: false, reportTurtle: await serialize(report.dataset as Iterable<Quad>) };
}
