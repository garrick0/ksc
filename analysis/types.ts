/**
 * Analysis types — port interfaces for the analysis layer.
 *
 * Ports defined here:
 *   - AnalysisSpec<K, P>  — what an analysis definition provides
 *   - AttrDecl<K>         — attribute declarations (discriminated union)
 *   - CodegenTarget<K, P> — what a codegen composition root provides
 *   - GeneratedImports    — import path configuration for generated files
 *
 * Domain types live in the spec that defines them
 * (e.g., specs/ts-ast/kind-checking/types.ts).
 */

import type { Ctx } from './ctx.js';
import type { Grammar } from '../grammar/index.js';

// ── Generated file output ──

/** A generated output file (path + content). Defined locally to avoid grammar/ dependency. */
export interface GeneratedFile {
  path: string;
  content: string;
}

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

// ── Attribute Dep Graph ──

/** Attribute dependency graph data for visualization. */
export interface AttributeDepGraph {
  /** All attribute names. */
  attributes: string[];
  /** Edges: [source, target] means source depends on target. */
  edges: [string, string][];
  /** Evaluation order (topological). */
  order: string[];
  /** Declaration metadata per attribute. */
  declarations: Record<string, { direction: string }>;
}

// ═══════════════════════════════════════════════════════════════════════
// Analysis Spec Interfaces
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

// ── Analysis spec ──

export interface AnalysisSpec<K extends string = string, P extends Record<string, unknown> = Record<string, unknown>> {
  /** All attributes — spec provides the complete list (no automatic derivation). */
  attrs: AttrDecl<K>[];
  /** Projection functions: extract final results from root. Typed by P for end-to-end type safety. */
  projections: { [Key in keyof P]: (root: Ctx) => P[Key] };
  /** Type import lines for generated files (domain types like KindDefinition, Diagnostic). */
  typeImports?: (paths: ImportPaths) => string[];
  /** Optional setup function called before each evaluation (e.g., resetCounter). */
  setup?: () => void;
}

// ── Codegen target (composition root contract) ──

/** Import paths emitted into generated files. */
export interface GeneratedImports {
  /** Import path for the analysis spec (used in generated dispatch). */
  specImportPath?: string;
  /** Import path from generated files to grammar output (e.g. '../grammar/index.js'). */
  grammarImportPath?: string;
  /** Import path from generated files to analysis/ machinery (e.g. '../../../analysis'). */
  analysisImportPath?: string;
  /** Import path from generated files to evaluator/ module (e.g. '../../../evaluator'). */
  evaluatorImportPath?: string;
  /** Import path for equation functions. Defaults to specImportPath with '/spec.js' replaced by '/equations/index.js'. */
  equationsImportPath?: string;
}

/**
 * Port: CodegenTarget — what a codegen composition root provides to the pipeline.
 *
 * Bundles the grammar + spec + output configuration that the codegen pipeline
 * needs to generate dispatch functions and attr-type maps.
 *
 * The K type parameter links grammar and spec, preventing mismatched pairings.
 *
 * @example
 *   // app/analysis-codegen/ts-kind-checking.ts
 *   const target: CodegenTarget<TSNodeKind, KSCProjections> = {
 *     grammar,
 *     spec: analysisSpec,
 *     outputDir: 'generated/ts-ast/kind-checking',
 *     generatedImports: { specImportPath: '...', ... },
 *   };
 */
export interface CodegenTarget<K extends string = string, P extends Record<string, unknown> = Record<string, unknown>> {
  grammar: Grammar<K>;
  spec: AnalysisSpec<K, P>;
  outputDir: string;
  generatedImports: GeneratedImports;
}

// ── Compiled output ──

export interface CompiledAttrDef {
  name: string;
  direction: AttrDirection;
  type: string;
}

export interface CompiledAnalyzer {
  dispatchFile: GeneratedFile;
  attrTypesFile: GeneratedFile;
  attrs: CompiledAttrDef[];
  depGraph: AttributeDepGraph;
}
