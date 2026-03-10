/**
 * App-level type definitions for the TS AST kind-checking target.
 *
 * Generic pipeline types (EvaluationPipeline, EvaluationResult) live in
 * evaluator/types.ts as reusable ports. This file contains only the
 * concrete KSProgramInterface for this specific composition root.
 */

import type { AttributeDepGraph } from '../../../analysis/index.js';
import type { KindDefinition, Diagnostic } from '../../../specs/ts-ast/kind-checking/types.js';
import type { KSCompilationUnit } from '../../../specs/ts-ast/grammar/index.js';
import type { KSTree } from '../../../specs/ts-ast/frontend/convert.js';

/** Concrete program interface for the TS AST kind-checking target. */
export interface KSProgramInterface {
  getRootFileNames(): string[];
  getCompilationUnits(): KSCompilationUnit[];
  getKindDefinitions(): KindDefinition[];
  getDiagnostics(): Diagnostic[];
  getKSTree(): KSTree;
  getAttributeDepGraph(): AttributeDepGraph;
}
