import { getLoggerFor } from 'global-logger-factory';
import type { ResourceStore } from '@solid/community-server';
import { Parser } from 'n3';

const logger = getLoggerFor('mem-trigger:loadDurableContainers');

const SOLID_INSTANCE_CONTAINER = 'http://www.w3.org/ns/solid/terms#instanceContainer';

export async function loadDurableContainers(
  store: ResourceStore,
  typeIndexUri: string,
): Promise<Set<string>> {
  let turtle: string;
  try {
    const representation = await store.getRepresentation(
      { path: typeIndexUri },
      { type: { 'text/turtle': 1 } },
    );
    turtle = await streamToString(representation.data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Could not load Type Index at ${typeIndexUri}: ${msg}`);
    return new Set();
  }

  const parser = new Parser({ baseIRI: typeIndexUri });
  const result = new Set<string>();
  try {
    parser.parse(turtle, (error, quad) => {
      if (error) {
        logger.warn(`Type Index parse error: ${error.message}`);
        return;
      }
      if (!quad) return;
      if (quad.predicate.value === SOLID_INSTANCE_CONTAINER) {
        const url = new URL(quad.object.value);
        let path = url.pathname;
        if (!path.endsWith('/')) path += '/';
        result.add(path);
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Type Index parse exception: ${msg}`);
    return new Set();
  }

  return result;
}

async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
