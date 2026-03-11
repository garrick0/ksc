/**
 * Application-layer types — shared interfaces for use cases.
 */

import type ts from 'typescript';
import type { KSTree } from '../adapters/grammar/ast-translator/ts-ast/convert.js';
import type { KSCompilationUnit, KSProgram } from '../adapters/grammar/grammar/ts-ast/index.js';
import type { KindDefinition, Diagnostic } from '../adapters/analysis/spec/ts-kind-checking/index.js';
import type { AttributeDepGraph } from '@kindscript/core-grammar';
import type { Evaluator } from '@kindscript/core-evaluator';
import type { AstTranslatorPort } from '@kindscript/core-grammar';
import type { AnalysisDepth } from '../api.js';

// Re-export config types from the lightweight API root
export { defineConfig, isAnalysisDepth, parseAnalysisDepth } from '../api.js';
export type { AnalysisDepth, KindScriptConfig } from '../api.js';

// ── Dependency interface ────────────────────────────────────────────

/** Projections returned by the ts-kind-checking evaluator. */
export interface CheckProjections extends Record<string, unknown> {
  definitions: KindDefinition[];
  diagnostics: Diagnostic[];
}

/**
 * Dependencies for check-program and check-project use cases.
 *
 * Generic over M (attr map) and P (projections) to support future analyses.
 * Defaults to the ts-kind-checking types for backward compatibility.
 */
export interface CheckDeps<M = Record<string, unknown>, P extends Record<string, unknown> = CheckProjections> {
  evaluator: Evaluator<M, P>;
  translator: AstTranslatorPort<ts.Program, KSProgram, AnalysisDepth>;
  depGraph: AttributeDepGraph;
}

// ── Program interface ───────────────────────────────────────────────

/** Concrete program interface for the TS AST kind-checking target. */
export interface KSProgramInterface {
  getRootFileNames(): string[];
  getCompilationUnits(): KSCompilationUnit[];
  getKindDefinitions(): KindDefinition[];
  getDiagnostics(): Diagnostic[];
  getKSTree(): KSTree;
  getAttributeDepGraph(): AttributeDepGraph;
}
