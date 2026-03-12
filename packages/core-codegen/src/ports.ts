/**
 * Codegen port contracts — interfaces for analysis declarations and code generation.
 *
 * Ports defined here:
 *   - AnalysisDecl<K>    — what an analysis declares for code generation
 *   - AttrDecl<K>        — attribute declarations (discriminated union)
 *   - AttrExpr / CodeLiteral — expression vocabulary for attribute fields
 */

// ── AttrExpr types ──

/** Tagged wrapper for literal code strings that aren't function calls. */
export interface CodeLiteral {
  readonly __codeLiteral: true;
  readonly code: string;
}

/** Create a CodeLiteral wrapping a raw code expression. */
export function code(expr: string): CodeLiteral {
  return { __codeLiteral: true, code: expr };
}

/** Type guard for CodeLiteral. */
export function isCodeLiteral(value: unknown): value is CodeLiteral {
  return value !== null && typeof value === 'object' && '__codeLiteral' in value && value.__codeLiteral === true;
}

/**
 * What AttrDecl expression fields accept.
 * - Function: equation function reference (emitted as fn.name(this) or fn.name(this, param))
 * - null, number, boolean: literal values
 * - CodeLiteral: raw code expression string
 */
export type AttrExpr = Function | null | number | boolean | CodeLiteral;

// ── Equation function types (see ADR-002) ──

/**
 * Typed equation function: receives context, returns attribute value.
 *
 * The ctx parameter uses `any` because the compile pipeline only reads fn.name —
 * type safety for ctx narrowing is enforced at the equation declaration site
 * (where the author writes KindCtx<KSIdentifier>), not at the AttrDecl assignment site.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EquationFn<T = unknown> = ((ctx: any, ...args: any[]) => T) & { deps?: string[] };

/** Per-kind equation map: kind → equation function. */
export type EquationMap<K extends string, T = unknown> = Partial<Record<K, EquationFn<T>>>;

/**
 * Equation map with per-kind ctx narrowing.
 *
 * CtxMap maps each kind string to its expected ctx type (e.g., KindCtx<KindToNode[K]>).
 * The mapped type ensures each equation function receives the correct ctx for its kind.
 * Structurally assignable to EquationMap<K, T> since EquationFn uses `any` for ctx.
 *
 * Usage (in an analysis adapter):
 *   type MyCtxMap = { [K in MyKind]: KindCtx<KindToNode[K]> };
 *   type MyEquationMap<T> = TypedEquationMap<MyKind, MyCtxMap, T>;
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TypedEquationMap<
  K extends string,
  CtxMap extends Partial<Record<K, unknown>>,
  T = unknown,
> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [Kind in K]?: ((ctx: Kind extends keyof CtxMap ? CtxMap[Kind] : unknown, ...args: any[]) => T) & { deps?: string[] };
};

// ═══════════════════════════════════════════════════════════════════════
// Attribute Declarations
// ═══════════════════════════════════════════════════════════════════════

// ── Attribute declarations (discriminated union by direction) ──

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

// ── Import path options ──

/** Import path options passed to typeImports callbacks. */
export interface ImportPaths {
  specImportPath: string;
}

// ── Analysis declaration (codegen-time concern) ──

/**
 * What an analysis declares for code generation.
 *
 * Consumed by compileAnalysis and CodegenTarget — never needed at runtime.
 * Contains attribute declarations and type import configuration.
 */
export interface AnalysisDecl<K extends string = string> {
  /** All attributes — spec provides the complete list (no automatic derivation). */
  attrs: AttrDecl<K>[];
  /** Type import lines for generated files (domain types like KindDefinition, Diagnostic). */
  typeImports?: (paths: ImportPaths) => string[];
}
