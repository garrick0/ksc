/**
 * Kinds Domain Language (DSL) — Marker types for source code annotations.
 *
 * This package provides the vocabulary users use inside their source code
 * to annotate kinds. It should be the ONLY package imported into production
 * domain logic.
 *
 * @example
 * ```typescript
 * import type { Kind, PropertySet } from '@ksc/kinds';
 *
 * type Pure = Kind<{ pure: true }>;
 * ```
 */

/** The vocabulary of properties a kind can declare. */
export interface PropertySet {
  readonly noImports?: true;
  readonly noConsole?: true;
  readonly immutable?: true;
  readonly static?: true;
  readonly noSideEffects?: true;
  readonly noMutation?: true;
  readonly noIO?: true;
  readonly pure?: true;
}

/**
 * A phantom type that carries property information.
 *
 * Define a kind:
 *   type NoImports = Kind<{ noImports: true }>;
 *
 * Annotate a value:
 *   const add: NoImports & ((a: number, b: number) => number) = (a, b) => a + b;
 */
export type Kind<R extends PropertySet> = { readonly __kind?: R };
