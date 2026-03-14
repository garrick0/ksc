import type { Ctx } from './Ctx.js';
import type { ASTNode } from '@ksc/grammar/index.js';

/** The AGNode type — a decorated AST node that implements Ctx. */
export interface AGNodeInterface extends Ctx {
  readonly node: ASTNode;
  readonly parent: AGNodeInterface | undefined;
  readonly children: readonly AGNodeInterface[];
  readonly isRoot: boolean;
  readonly fieldName: string | undefined;
}

/**
 * Type-safe AGNode — narrows `attr()` return types using a generated attr map.
 *
 * Usage:
 *   const tree = evaluate<KSCAttrMap>({ grammar, dispatch, root });
 *   tree.attr('kindDefs')  // → KindDefinition[]  (not any)
 *
 * Parameterized attributes (not in the map) fall through to `any`.
 */
export type TypedAGNode<M> = Omit<AGNodeInterface, 'attr' | 'parent' | 'children'> & {
  attr<K extends string & keyof M>(name: K): M[K];
  attr(name: string, ...args: unknown[]): any;
  readonly parent: TypedAGNode<M> | undefined;
  readonly children: readonly TypedAGNode<M>[];
}
