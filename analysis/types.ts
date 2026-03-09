/**
 * Analysis types — spec interfaces and generic AG infrastructure types.
 *
 * Domain types live in the spec that defines them
 * (e.g., specs/ts-ast/kind-checking/types.ts).
 * This module only defines AG-level interfaces: AttrDecl, AnalysisSpec, etc.
 */

import type { Ctx } from './ctx.js';

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
  return value !== null && typeof value === 'object' && (value as any).__codeLiteral === true;
}

/**
 * What AttrDecl expression fields accept.
 * - Function: equation function reference (emitted as fn.name(this) or fn.name(this, param))
 * - null, number, boolean: literal values
 * - CodeLiteral: raw code expression string
 */
export type AttrExpr = Function | null | number | boolean | CodeLiteral;

/**
 * Attach dependency metadata to an equation function.
 * Mutates the function in place (preserves fn.name for import generation).
 */
export function withDeps<F extends (...args: any[]) => any>(deps: string[], fn: F): F & { deps: string[] } {
  (fn as any).deps = deps;
  return fn as F & { deps: string[] };
}

/**
 * Collect all dependency names for an attribute by reading .deps from
 * all Function-typed values in the attr declaration.
 */
export function collectDepsForAttr(attr: AttrDecl): string[] {
  const deps = new Set<string>();

  function addFromValue(v: AttrExpr | undefined) {
    if (typeof v === 'function' && Array.isArray((v as any).deps)) {
      for (const d of (v as any).deps) deps.add(d);
    }
  }

  function addFromRecord(rec: Record<string, Function> | undefined) {
    if (!rec) return;
    for (const fn of Object.values(rec)) {
      if (Array.isArray((fn as any).deps)) {
        for (const d of (fn as any).deps) deps.add(d);
      }
    }
  }

  switch (attr.direction) {
    case 'syn':
      addFromValue(attr.default);
      addFromRecord(attr.equations);
      break;
    case 'inh':
      addFromValue(attr.rootValue);
      addFromRecord(attr.parentEquations);
      break;
    case 'collection':
      addFromValue(attr.init);
      break;
  }

  return [...deps];
}

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
export interface SynAttr extends AttrBase {
  direction: 'syn';
  /** Default value: Function (called as fn(this) or fn(this, param)), literal, or code expression. */
  default: AttrExpr;
  /** Per-kind equation functions. Key = node kind, value = equation function reference. */
  equations?: Record<string, Function>;
}

/** Inherited: provided by parent, copied down the tree. */
export interface InhAttr extends AttrBase {
  direction: 'inh';
  /** Root value: Function (called), literal, or code expression. */
  rootValue: AttrExpr;
  /** Per-parent-kind override equation functions. Return T to override, undefined = copy-down. */
  parentEquations?: Record<string, Function>;
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
export type AttrDecl = SynAttr | InhAttr | CollectionAttr;

// ── Grammar config ──

/** Grammar-specific configuration provided by the spec. */
export interface GrammarConfig {
  /** The root node kind (e.g., 'CompilationUnit'). */
  rootKind: string;
  /** The field name on the root node that contains the file name (e.g., 'fileName'). */
  fileNameField: string;
}

// ── Evaluator setup ──

/** Import path options passed to evaluatorSetup callbacks. */
export interface ImportPaths {
  specImportPath: string;
}

/** Spec-provided evaluator customizations. */
export interface EvaluatorSetup {
  /** Additional import lines for the generated evaluator. */
  imports: (paths: ImportPaths) => string[];
  /** Import lines for generated attr-types.ts (domain type imports). */
  attrTypesImports?: (paths: ImportPaths) => string[];
  /** Module-level setup lines (emitted after imports). */
  moduleSetup?: string[];
  /** Additional helper methods on KSCDNode class. */
  helperMethods?: string[];
  /**
   * Spec-provided evaluation entry point.
   * Emitted after the static dep graph. Provides the full EvaluationResult
   * interface, evaluate() function, and buildTree() helper.
   * If omitted, compile.ts generates a generic no-op evaluate.
   */
  evaluateBody?: (paths: ImportPaths) => string[];
}

// ── Analysis spec ──

export interface AnalysisSpec {
  /** All attributes — spec provides the complete list (no automatic derivation). */
  attrs: AttrDecl[];
  /** Projection functions: extract final results from root. */
  projections: Record<string, (root: Ctx) => unknown>;
  /** Grammar-specific configuration (replaces hardcoded kind names in compile.ts). */
  grammarConfig: GrammarConfig;
  /** Spec-owned evaluator customizations (imports, module setup, helper methods). */
  evaluatorSetup?: EvaluatorSetup;
}

// ── Compiled output ──

export interface CompiledAttrDef {
  name: string;
  direction: AttrDirection;
  type: string;
}

export interface CompiledAnalyzer {
  evaluatorFile: GeneratedFile;
  attrTypesFile: GeneratedFile;
  attrs: CompiledAttrDef[];
  depGraph: AttributeDepGraph;
}
