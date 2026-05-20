import { getLoggerFor } from 'global-logger-factory';
import { Parser } from 'n3';

const logger = getLoggerFor('mem-trigger:loadDurableContainers');

const SOLID_INSTANCE_CONTAINER = 'http://www.w3.org/ns/solid/terms#instanceContainer';

/**
 * Loads durable container paths from the Solid Type Index via HTTP fetch().
 *
 * Uses fetch() rather than store.getRepresentation() to avoid re-entering
 * CSS's LockingResourceStore. store.getRepresentation() on the Type Index
 * from inside a MonitoringStore 'changed' handler triggers a lock conflict
 * (CSS holds the parent-container write lock during the event; the read lock
 * on publicTypeIndex blocks for 6s then crashes with an uncatchable stream
 * error). HTTP self-requests use a separate network path and bypass the lock.
 */
export async function loadDurableContainers(
  typeIndexUri: string,
): Promise<Set<string>> {
  let turtle: string;
  try {
    const resp = await fetch(typeIndexUri, { headers: { Accept: 'text/turtle' } });
    if (!resp.ok) {
      logger.warn(`Could not load Type Index at ${typeIndexUri}: HTTP ${resp.status}`);
      return new Set();
    }
    turtle = await resp.text();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Could not load Type Index at ${typeIndexUri} (will retry on next write): ${msg}`);
    return new Set();
  }
  if (!turtle) return new Set();

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
