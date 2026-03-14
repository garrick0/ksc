import type { AttrExpr, CodeLiteral } from './AttrExpr.js';
import type { EquationMap } from './EquationFn.js';

export type AttrDirection = 'syn' | 'inh' | 'collection';

/** Parameter definition for parameterized attributes (JastAdd-style). */
export interface ParamDef {
  /** Parameter name (used in method signature and equation expressions). */
  name: string;
  /** TypeScript type string. */
  type: string;
}

interface AttrBase {
  /** Attribute name (e.g., 'kindDefs', 'contextFor'). */
  name: string;
  /** TypeScript type string for the attribute's return type. */
  type: string;
  /** If set, generates a parameterized method with Map-based caching. */
  parameter?: ParamDef;
}

/** Synthesized: computed at each node, optionally dispatched by node kind. */
export interface SynAttr<K extends string = string> extends AttrBase {
  direction: 'syn';
  /**
   * Default value for kinds without explicit equations.
   * If omitted, `equations` must cover every kind in `allKinds` (exhaustive).
   */
  default?: AttrExpr;
  /** Per-kind equation functions. Key = node kind, value = equation function reference. */
  equations?: EquationMap<K>;
}

/** Inherited: provided by parent, copied down the tree. */
export interface InhAttr<K extends string = string> extends AttrBase {
  direction: 'inh';
  /** Root value: Function (called), literal, or code expression. */
  rootValue: AttrExpr;
  /** Per-parent-kind override equation functions. Return T to override, undefined = copy-down. */
  parentEquations?: EquationMap<K>;
}

/** Collection: fold a per-node value over children. */
export interface CollectionAttr extends AttrBase {
  direction: 'collection';
  /** Per-node contribution: literal value or code expression. */
  init: AttrExpr;
  /** Binary combine function as a code expression: (accumulator, childContribution) => combined. */
  combine: CodeLiteral;
}

/** A single attribute declaration in the analysis spec. */
export type AttrDecl<K extends string = string> = SynAttr<K> | InhAttr<K> | CollectionAttr;
