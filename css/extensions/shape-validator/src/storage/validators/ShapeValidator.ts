/**
 * Base class for shape validators.
 * Ported from CommunitySolidServer/shape-validator-component for CSS v8.
 * AsyncHandler moved from @solid/community-server to asynchronous-handlers in v8.
 */
import type { Representation } from '@solid/community-server';
import { AsyncHandler } from 'asynchronous-handlers';

export type ShapeValidatorInput = {
  /** Representation of the parent container (used to find the shape URL via ldp:constrainedBy). */
  parentRepresentation: Representation;
  /** Representation of the resource being validated against the shape. */
  representation: Representation;
};

/**
 * Validates a resource's representation against a SHACL shape.
 * Only handles validation if the parent container has:
 *   `<containerURL> ldp:constrainedBy <shapeURL>` in its .meta description.
 */
export abstract class ShapeValidator extends AsyncHandler<ShapeValidatorInput> {}
