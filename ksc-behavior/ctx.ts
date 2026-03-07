/**
 * Ctx — the context interface for AG equation functions.
 *
 * KSCDNode (the compiled evaluator) implements this interface.
 */

import type { KSNode } from '../ast-schema/generated/index.js';
import type { KSCAttrMap } from './attr-types.js';

/** Context passed to equation functions. */
export interface Ctx {
  readonly node: KSNode;
  readonly parent: Ctx | undefined;
  readonly children: readonly Ctx[];
  readonly isRoot: boolean;
  attr<K extends string & keyof KSCAttrMap>(name: K): KSCAttrMap[K];
  attr(name: string): any;
  parentIs(kind: string, field?: string): boolean;
}
