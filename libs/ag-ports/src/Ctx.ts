import type { ASTNode } from '@ksc/grammar/index.js';

/** Context passed to equation functions. */
export interface Ctx {
  readonly node: ASTNode;
  readonly parent: Ctx | undefined;
  readonly children: readonly Ctx[];
  readonly isRoot: boolean;
  readonly fieldName: string | undefined;
  attr(name: string, ...args: unknown[]): any;
  parentIs(kind: string, field?: string): boolean;
  findFileName(): string;
}

/** Kind-narrowed context — Ctx with `node` refined to a specific AST node type. */
export type KindCtx<N extends ASTNode = ASTNode> = Ctx & { readonly node: N };
