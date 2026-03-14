/**
 * Codegen module barrel — ports, compilation, and equation framework.
 *
 * Ports:
 *   AnalysisDecl<K>       — what an analysis declares for code generation
 *   CodegenTarget<K>      — what a codegen composition root provides
 *
 * Machinery:
 *   compile.ts    — compileAnalysis(Grammar, AnalysisDecl) → CompiledAnalyzer
 *   validate.ts   — spec validation (attr dep consistency)
 *   pivot.ts      — pivotToAttrCentric (equation reshaping)
 */

// Application: port interfaces
export type { AnalysisDecl, ImportPaths } from './application/ports/AnalysisDecl.js';
export type {
  AttrDecl,
  SynAttr,
  InhAttr,
  CollectionAttr,
  AttrDirection,
  ParamDef,
} from './application/ports/AttrDecl.js';
export type { CodeLiteral, AttrExpr } from './application/ports/AttrExpr.js';
export { code, isCodeLiteral } from './application/ports/AttrExpr.js';
export type { EquationFn, EquationMap, TypedEquationMap } from './application/ports/EquationFn.js';
export type { CodegenTarget, GeneratedImports } from './application/ports/CodegenTarget.js';

// Supporting types (AttributeDepGraph re-exported from core-grammar)
export type { AttributeDepGraph } from '@ksc/grammar/index.js';
export type { CompiledAnalyzer, CompiledAttrDef, GeneratedFile } from './domain/types.js';

// Validation (application)
export type { ValidationDiagnostic } from './application/validate.js';

// Equation utilities (application)
export { withDeps, collectDepsForAttr } from './application/equation-utils.js';

// Machinery (application)
export { compileAnalysis, buildDepGraph, validateSpecConsistency } from './application/compile.js';
export { validateSpec } from './application/validate.js';
export { pivotToAttrCentric } from './application/pivot.js';
