/**
 * SpecInput — the user-facing attribute grammar specification.
 *
 * Separates declarations (WHAT each attribute is) from
 * equations (HOW each attribute is computed).
 */

import type { AttrDecl } from './decl.js';

export interface SpecInput<N extends object, R = unknown> {
  name: string;

  /** Attribute declarations: name -> domain metadata. */
  declarations: Record<string, AttrDecl>;

  /**
   * Attribute equations: name -> computation.
   *
   * The equation form depends on the declaration's direction:
   *   syn:      (node: N) => V  OR  { Production: (n) => V, _: (n) => V }
   *   inh:      ((parent: N, child: N, idx: number) => V | undefined)  OR  undefined
   *   circular: (node: N) => V
   *   paramSyn: (node: N, param: P) => V
   */
  equations: Record<string, unknown>;

  /** Specs that must be evaluated before this one. */
  deps?: string[];

  /** Extract results from the attributed tree. */
  project?: (root: N) => R;
}
