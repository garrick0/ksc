/**
 * Application layer barrel — npm composition root for kindscript/ts-kind-checking.
 *
 * This module is the composition root for library consumers. It imports
 * pre-composed adapter instances from wiring and binds them into the
 * application-layer use cases, exporting ready-to-use functions.
 *
 * Use cases (pre-wired):
 *   checkProject                              — check a project directory
 *   createProgram, createProgramFromTSProgram  — check from pre-resolved files + config
 *   parseOnly                                  — parse without evaluation
 *
 * Use cases (standalone, no wiring needed):
 *   runCodegenPipeline                         — validate + compile + write (takes CodegenTarget)
 *   findRootFiles, findConfig, loadConfig, resolveConfig
 *
 * Not in barrel (to avoid pulling in all codegen target adapters):
 *   runAllCodegen (codegen/run-all-codegen.ts)   — accepts targets as parameter
 */

import ts from 'typescript';

// Evaluation wiring — adapter composition
import { evaluator, tsToAstTranslatorAdapter, depGraph } from './evaluation/ts-kind-checking.js';

// Raw use cases (accept deps as first param)
import { createProgram as _createProgram, createProgramFromTSProgram as _createProgramFromTSProgram } from './check-program.js';
import { checkProject as _checkProject } from './check-project.js';
import { parseOnly as _parseOnly } from './parse-only.js';

// Types
import type { KSProgramInterface, CheckDeps, KindScriptConfig } from './types.js';
import type { ProjectCheckResult } from './check-project.js';
import type { AnalysisDepth } from '../api.js';
import type { KSTree } from '../adapters/grammar/ast-translator/ts-ast/convert.js';
import type { KSCAttrMap, KSCProjections } from '../adapters/analysis/spec/ts-kind-checking/index.js';

// ── Composition: bind deps to use cases ──────────────────────────────

const checkDeps: CheckDeps<KSCAttrMap, KSCProjections> = { evaluator, translator: tsToAstTranslatorAdapter, depGraph };

/** Create a KindScript program from file paths. */
export function createProgram(
  rootNames: string[],
  config?: KindScriptConfig,
  options?: ts.CompilerOptions,
): KSProgramInterface {
  return _createProgram(checkDeps, rootNames, config, options);
}

/** Create a KindScript program from an existing TypeScript program. */
export function createProgramFromTSProgram(
  tsProgram: ts.Program,
  config?: KindScriptConfig,
): KSProgramInterface {
  return _createProgramFromTSProgram(checkDeps, tsProgram, config);
}

/** Check a project directory: resolve config, discover files, evaluate. */
export async function checkProject(
  rootDir: string,
  options?: { configPath?: string; depth?: AnalysisDepth },
): Promise<ProjectCheckResult> {
  return _checkProject(checkDeps, rootDir, options);
}

/** Parse-only pipeline: convert TS AST to KS AST without attribute evaluation. */
export function parseOnly(
  rootNames: string[],
  options?: ts.CompilerOptions,
  depth?: AnalysisDepth,
): KSTree {
  return _parseOnly(tsToAstTranslatorAdapter, rootNames, options, depth);
}

// ── Standalone use cases (no wiring needed) ──────────────────────────

export { runCodegenPipeline } from './codegen/run-codegen.js';
export type { CodegenPipelineResult, CodegenResult, CodegenFailure, WrittenFile } from './codegen/run-codegen.js';
export { findRootFiles } from './find-files.js';
export { findConfig, loadConfig, resolveConfig } from './config.js';

// ── Types ────────────────────────────────────────────────────────────

export type { CheckDeps, CheckProjections, KSProgramInterface } from './types.js';
export type { ProjectCheckResult } from './check-project.js';
export type { KindDefinition, Diagnostic } from '../adapters/analysis/spec/ts-kind-checking/index.js';
