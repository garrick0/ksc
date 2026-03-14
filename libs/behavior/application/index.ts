/**
 * Codegen application barrel — compilation pipeline, validation, and equation utilities.
 */

// ── Compilation ──

export { compileAnalysis, buildDepGraph, validateSpecConsistency } from './compile.js';

// ── Validation ──

export { validateSpec } from './validate.js';
export type { ValidationDiagnostic } from './validate.js';

// ── Equation utilities ──

export { withDeps, collectDepsForAttr } from './equation-utils.js';

// ── Pivot ──

export { pivotToAttrCentric } from './pivot.js';

// ── Use cases ──

export { runCodegenPipeline } from './run-codegen.js';
export type { CodegenResult, CodegenFailure, CodegenPipelineResult, WrittenFile } from './run-codegen.js';

export { runAllCodegen } from './run-all-codegen.js';
export type { NamedCodegenTarget, AllCodegenResult } from './run-all-codegen.js';
