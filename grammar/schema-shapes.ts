/**
 * Schema validation shapes — types for `as const satisfies` grammar schemas.
 *
 * Types defined here:
 *   - FieldDescShape    — shape for field descriptors in node definitions
 *   - NodeDefShape      — shape for individual node definitions
 *   - SumTypeDefShape   — shape for sum type definitions
 */

export type FieldDescShape =
  | { tag: 'child'; typeRef?: string }
  | { tag: 'optChild'; typeRef?: string }
  | { tag: 'list'; typeRef?: string }
  | { tag: 'prop'; propType: string };

export interface NodeDefShape {
  memberOf: readonly string[];
  fields: Record<string, FieldDescShape>;
}

export interface SumTypeDefShape {
  fields?: Record<string, FieldDescShape>;
  includes?: readonly string[];
}
