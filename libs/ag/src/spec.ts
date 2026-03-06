/**
 * Attribute declarations and spec input — the "domain" layer.
 *
 * Declarations describe WHAT an attribute is (direction, domain metadata)
 * independently of HOW it is computed (the equation).
 *
 * SpecInput is the user-facing specification that pairs declarations
 * with equations.
 */

// ── Type-level helpers for production equations ──────────────────────────

/** Extract all possible `kind` values from a discriminated union. */
type KindValues<N> = N extends { kind: infer K extends string } ? K : never;

/**
 * Type-safe production equation map.
 *
 * When N is a discriminated union with `kind`:
 *   - Keys are validated against the union's kind values (typo protection)
 *   - Each callback's node parameter is narrowed to the matching member
 *   - `_` is the optional default handler
 *
 * When N has no `kind` field: degrades to Record<string, ...> + `_`.
 */
export type ProductionEquations<N extends object, V> =
  & { [K in KindValues<N>]?: (node: Extract<N, { kind: K }>) => V }
  & { _?: (node: N) => V };

// ── Declaration types ────────────────────────────────────────────────────

export interface SynDecl {
  direction: 'syn';
  uncached?: boolean;
  /** When equation is a production map, dispatch on this field (default: 'kind'). */
  discriminant?: string;
}

export interface ParamSynDecl {
  direction: 'paramSyn';
}

export interface InhDecl<V = any> {
  direction: 'inh';
  root: V | ((root: any) => V);
}

export interface CircularDecl<V = any> {
  direction: 'circular';
  bottom: V;
  equals?: (a: V, b: V) => boolean;
}

export interface CollectionDecl<V = any> {
  direction: 'collection';
  initial: V;
  combine: (acc: V, contrib: V) => V;
}

export type AttrDecl<V = any> = SynDecl | ParamSynDecl | InhDecl<V> | CircularDecl<V> | CollectionDecl<V>;

// ── SpecInput ────────────────────────────────────────────────────────────

export interface SpecInput<N extends object, R = unknown> {
  name: string;

  /** Attribute declarations: name -> domain metadata. */
  declarations: Record<string, AttrDecl>;

  /**
   * Attribute equations: name -> computation.
   *
   * The equation form depends on the declaration's direction:
   *   syn:        (node: N) => V  OR  { Production: (n) => V, _: (n) => V }
   *   inh:        ((parent: N, child: N, idx: number) => V | undefined)  OR  undefined
   *   circular:   (node: N) => V
   *   collection: (node: N) => V  OR  { Production: (n) => V, _: (n) => V }
   *   paramSyn:   (node: N, param: P) => V
   */
  equations: Record<string, unknown>;

  /** Specs that must be evaluated before this one. */
  deps?: string[];

  /** Extract results from the attributed tree. */
  project?: (root: N) => R;
}
