/**
 * Ctx — the context interface for AG equation functions.
 *
 * AGNode (the hand-written evaluator engine) implements this interface.
 * Generic contract — references ASTNode (the shared grammar contract type)
 * rather than any specific generated node type.
 */

import type { ASTNode } from '../grammar/index.js';

/** Context passed to equation functions. */
export interface Ctx {
  readonly node: ASTNode;
  readonly parent: Ctx | undefined;
  readonly children: readonly Ctx[];
  readonly isRoot: boolean;
  attr(name: string, ...args: unknown[]): any;
  parentIs(kind: string, field?: string): boolean;
  findFileName(): string;
}

/**
 * Kind-narrowed context — Ctx with `node` refined to a specific AST node type.
 *
 * Used by per-kind equation functions to avoid manual casts:
 *   function eq_violationFor_Identifier(ctx: KindCtx<KSIdentifier>) { ctx.node.escapedText; }
 *
 * The generated evaluator casts `this as KindCtx<KindToNode[K]>` when calling
 * per-kind equations.
 */
export type KindCtx<N extends ASTNode = ASTNode> = Ctx & { readonly node: N };
