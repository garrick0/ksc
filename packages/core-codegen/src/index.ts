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

// Port interfaces
export type { AnalysisDecl, AttrDecl, SynAttr, InhAttr, CollectionAttr } from './ports.js';
export type { ParamDef, ImportPaths } from './ports.js';

// Codegen types
export type { CodegenTarget, GeneratedImports } from './codegen-types.js';

// Supporting types (AttributeDepGraph re-exported from core-grammar)
export type { AttributeDepGraph } from '@kindscript/core-grammar';
export type { CompiledAnalyzer, CompiledAttrDef, GeneratedFile } from './codegen-types.js';
export type { CodeLiteral, AttrExpr, AttrDirection } from './ports.js';
export { code, isCodeLiteral } from './ports.js';

// Validation
export type { ValidationDiagnostic } from './validate.js';

// Equation utilities
export { withDeps, collectDepsForAttr } from './equation-utils.js';
export type { EquationFn, EquationMap, TypedEquationMap } from './ports.js';

// Machinery
export { compileAnalysis, buildDepGraph, validateSpecConsistency } from './compile.js';
export { validateSpec } from './validate.js';
export { pivotToAttrCentric } from './pivot.js';
