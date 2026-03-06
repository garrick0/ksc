/**
 * Schema-first node definitions.
 *
 * defineNode() is the single source of truth for AST node types.
 * Each call produces both a runtime schema entry AND (via InferNode<>)
 * the TypeScript interface for that node kind.
 *
 * Builder functions use phantom types to carry type information:
 *   child<T>()    — required single child node
 *   optChild<T>() — optional single child node (T | undefined)
 *   list<T>()     — array of child nodes (T[])
 *   prop<T>()     — non-child property
 */

// ── Field spec types (runtime + phantom type) ────────────────────────

export interface ChildSpec<T = any> {
  readonly __tag: 'child';
  /** @internal phantom type carrier */
  readonly __phantom?: T;
}

export interface OptChildSpec<T = any> {
  readonly __tag: 'optChild';
  /** @internal phantom type carrier */
  readonly __phantom?: T;
}

export interface ListSpec<T = any> {
  readonly __tag: 'list';
  /** @internal phantom type carrier */
  readonly __phantom?: T;
}

export interface PropSpec<T = any> {
  readonly __tag: 'prop';
  /** @internal phantom type carrier */
  readonly __phantom?: T;
}

export type FieldSpec = ChildSpec | OptChildSpec | ListSpec | PropSpec;

// ── Builder functions ────────────────────────────────────────────────

/** Required single child node. */
export function child<T = any>(): ChildSpec<T> {
  return { __tag: 'child' } as ChildSpec<T>;
}

/** Optional single child node (T | undefined). */
export function optChild<T = any>(): OptChildSpec<T> {
  return { __tag: 'optChild' } as OptChildSpec<T>;
}

/** Array of child nodes (T[]). */
export function list<T = any>(): ListSpec<T> {
  return { __tag: 'list' } as ListSpec<T>;
}

/** Non-child property (string, boolean, number, etc). */
export function prop<T>(): PropSpec<T> {
  return { __tag: 'prop' } as PropSpec<T>;
}

// ── Node definition ──────────────────────────────────────────────────

export interface NodeSpec {
  [field: string]: FieldSpec;
}

export interface NodeDef<K extends string = string, S extends NodeSpec = NodeSpec> {
  readonly kind: K;
  readonly fields: S;
  /** Names of fields that are children (child, optChild, list) — in declaration order. */
  readonly childFields: readonly string[];
  /** Names of fields that are props — in declaration order. */
  readonly propFields: readonly string[];
}

/**
 * Define a node type. This is the single source of truth.
 *
 * @example
 * const TypeAliasDeclaration = defineNode('TypeAliasDeclaration', {
 *   name: child<KSIdentifier>(),
 *   typeParameters: list(),
 *   type: child(),
 *   modifiers: list(),
 * });
 * type KSTypeAliasDeclaration = InferNode<typeof TypeAliasDeclaration>;
 */
export function defineNode<K extends string, S extends NodeSpec>(
  kind: K,
  fields: S,
): NodeDef<K, S> {
  const childFields: string[] = [];
  const propFields: string[] = [];

  for (const [name, spec] of Object.entries(fields)) {
    if (spec.__tag === 'prop') {
      propFields.push(name);
    } else {
      childFields.push(name);
    }
  }

  return { kind, fields, childFields, propFields };
}

/**
 * Define a leaf node (no extra fields beyond KSNodeBase).
 *
 * @example
 * const OpenBraceToken = defineLeaf('OpenBraceToken');
 */
export function defineLeaf<K extends string>(kind: K): NodeDef<K, {}> {
  return { kind, fields: {} as any, childFields: [], propFields: [] };
}

// ── Type-level inference ─────────────────────────────────────────────

/** Base fields present on every node. */
export interface NodeBase {
  pos: number;
  end: number;
  text: string;
  children: any[];
}

/** Infer a single field's TypeScript type from its spec. */
export type InferField<F> =
  F extends ChildSpec<infer T> ? T :
  F extends OptChildSpec<infer T> ? T | undefined :
  F extends ListSpec<infer T> ? T[] :
  F extends PropSpec<infer T> ? T :
  never;

/** Infer all fields from a NodeSpec. */
export type InferFields<S extends NodeSpec> = {
  [K in keyof S]: InferField<S[K]>;
};

/**
 * Infer the full TypeScript type for a node definition.
 *
 * @example
 * type KSTypeAliasDeclaration = InferNode<typeof TypeAliasDeclaration>;
 * // { kind: 'TypeAliasDeclaration'; name: KSIdentifier; type: KSNode; ... }
 */
export type InferNode<D extends NodeDef> =
  D extends NodeDef<infer K, infer S>
    ? { kind: K } & NodeBase & InferFields<S>
    : never;
