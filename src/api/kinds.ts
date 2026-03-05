/**
 * KindScript public type API.
 *
 * Users define kinds as types and annotate values with them:
 *
 *   import type { Kind, PropertySet } from 'kindscript';
 *
 *   type NoImports = Kind<{ noImports: true }>;
 *
 *   const add: NoImports & ((a: number, b: number) => number) = (a, b) => a + b;
 */

// ── PropertySet ──

/** The vocabulary of properties a kind can declare. */
export interface PropertySet {
  readonly noImports?: true;
}

// ── Kind ──

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
