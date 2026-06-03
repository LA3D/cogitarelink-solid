/**
 * pathConstraint.ts
 *
 * Path-based class constraint evaluator (D99 Layer 2 disjointness
 * enforcement). Catches mem:Event PUTs to content paths and vice versa
 * before per-resource SHACL dispatch runs.
 *
 * This is a pure function: no side effects, no async, no dependencies
 * beyond standard TypeScript types. Fully unit-testable in isolation.
 *
 * Task 23 wires this into the live shape-validator handler and Components.js
 * configuration.
 */

/**
 * Configuration for a path-based class constraint.
 *
 * pathPrefix: The resource path prefix to match (e.g., "/wiki/.events/")
 * allowedClasses: If non-empty, at least one resource class must match.
 *                 If empty, no allow-list is enforced (only forbid applies).
 * forbiddenClasses: Resource classes that are strictly forbidden at this path.
 *
 * Declared as a class (not interface) so componentsjs-generator emits a
 * concrete Class descriptor that Components.js can instantiate. The
 * ShapeValidationStore.pathConstraints parameter accepts these as an
 * AbstractClass via ParameterRangeWildcard — they arrive as plain objects
 * with the three member fields populated.
 */
export class PathConstraintConfig {
  public pathPrefix: string;
  public allowedClasses: string[];
  public forbiddenClasses: string[];

  public constructor(
    pathPrefix: string,
    allowedClasses: string[],
    forbiddenClasses: string[],
  ) {
    // A pathPrefix is a CONTAINER prefix: it must end with "/". Without this,
    // `startsWith(pathPrefix)` matches across container boundaries — e.g.
    // "/vault/wiki/events-archive/" startsWith "/vault/wiki/events" — silently
    // applying the events constraint to a different container (audit F2). Fail
    // loud at construction (config wiring time) rather than mis-route at write
    // time. Components.js instantiates this from the JSON config, so a
    // mis-configured prefix surfaces at server boot, not on a stray request.
    if (!pathPrefix.endsWith('/')) {
      throw new Error(
        `PathConstraintConfig.pathPrefix must end with "/" (container prefix), got: "${pathPrefix}"`,
      );
    }
    this.pathPrefix = pathPrefix;
    this.allowedClasses = allowedClasses;
    this.forbiddenClasses = forbiddenClasses;
  }
}

/**
 * Result of a path constraint evaluation.
 *
 * ok: true if the resource passes all constraints; false if a constraint
 *     rejects it.
 * violation: Details of the first matched violation (undefined if ok=true).
 */
export interface PathConstraintResult {
  ok: boolean;
  violation?: {
    pathPrefix: string;
    forbiddenClass?: string;
    notInAllowList?: string;
    message: string;
  };
}

/**
 * Evaluate a resource path + its rdf:type classes against a list of
 * path-based class constraints. Returns the first matching violation,
 * or { ok: true } if no constraint rejects the resource.
 *
 * Longest-prefix-wins: when multiple constraints match the resource path,
 * the one with the longest pathPrefix is applied.
 *
 * @param resourcePath  the resource being written (e.g. "/wiki/events/foo.md")
 * @param resourceClasses  rdf:type values declared by the resource
 * @param constraints  config list (typically from Components.js wiring)
 * @returns the constraint evaluation result
 */
export function evaluatePathConstraint(
  resourcePath: string,
  resourceClasses: string[],
  constraints: PathConstraintConfig[],
): PathConstraintResult {
  // Find all constraints whose pathPrefix matches the resource path
  const applicable = constraints
    .filter((c) => resourcePath.startsWith(c.pathPrefix))
    .sort((a, b) => b.pathPrefix.length - a.pathPrefix.length); // longest first

  // No applicable constraint = pass through
  if (applicable.length === 0) {
    return { ok: true };
  }

  const constraint = applicable[0];

  // Check forbidden classes (fail fast on first match)
  for (const cls of resourceClasses) {
    if (constraint.forbiddenClasses.includes(cls)) {
      return {
        ok: false,
        violation: {
          pathPrefix: constraint.pathPrefix,
          forbiddenClass: cls,
          message: `Resources at ${constraint.pathPrefix}* are disjoint with ${cls}. See </vault/ontology/wiki>.`,
        },
      };
    }
  }

  // Check allow-list (if non-empty, at least one resource class must match)
  if (constraint.allowedClasses.length > 0) {
    const hasAllowed = resourceClasses.some((c) =>
      constraint.allowedClasses.includes(c),
    );
    if (!hasAllowed) {
      return {
        ok: false,
        violation: {
          pathPrefix: constraint.pathPrefix,
          notInAllowList: resourceClasses[0],
          message: `Resources at ${constraint.pathPrefix}* must declare one of: ${constraint.allowedClasses.join(", ")}. Got: ${resourceClasses.join(", ")}.`,
        },
      };
    }
  }

  return { ok: true };
}
