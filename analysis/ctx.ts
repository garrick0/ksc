/**
 * Ctx — the context interface for AG equation functions.
 *
 * KSCDNode (the compiled evaluator) implements this interface.
 * This is a generic contract — no grammar-specific or analysis-specific imports.
 * The generated evaluator provides typed overloads via KSCDNode.
 */

/** Context passed to equation functions. */
export interface Ctx {
  readonly node: unknown;
  readonly parent: Ctx | undefined;
  readonly children: readonly Ctx[];
  readonly isRoot: boolean;
  attr(name: string, ...args: unknown[]): any;
  parentIs(kind: string, field?: string): boolean;
  findFileName(): string;
}
