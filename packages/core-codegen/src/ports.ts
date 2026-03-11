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
  equations?: Partial<Record<K, Function>>;
}

/** Inherited: provided by parent, copied down the tree. */
export interface InhAttr<K extends string = string> extends AttrBase {
  direction: 'inh';
  /** Root value: Function (called), literal, or code expression. */
  rootValue: AttrExpr;
  /** Per-parent-kind override equation functions. Return T to override, undefined = copy-down. */
  parentEquations?: Partial<Record<K, Function>>;
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
