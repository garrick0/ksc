/**
 * Grammar object — pure tree structure definition.
 *
 * Equivalent to JastAdd's .ast files: defines the tree shape
 * (how to extract children from a node) independently of any analysis.
 *
 * This is the functor F in the algebra: it describes the shape of
 * one layer of recursion. All specs evaluated over this grammar
 * share the same tree structure.
 */

// ── Types ────────────────────────────────────────────────────────────────

/**
 * A Grammar object — owns the tree structure.
 *
 * Equivalent to JastAdd's .ast grammar definition.
 * Create with `createGrammar(getChildren)`.
 */
export interface Grammar<N extends object> {
  /** The children accessor this grammar uses. */
  readonly getChildren: (node: N) => N[];
}

// ── Construction ─────────────────────────────────────────────────────────

/**
 * Create a Grammar — the shared tree-structure definition.
 *
 * All AG specs evaluated through this grammar share the same
 * `getChildren` accessor. The grammar is the .ast file equivalent.
 *
 * @param getChildren - How to extract children from a node
 */
export function createGrammar<N extends object>(
  getChildren: (node: N) => N[],
): Grammar<N> {
  return { getChildren };
}
