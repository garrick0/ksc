/**
 * App-level type definitions for KindScript.
 */

import type { AttributeDepGraph } from '../../analysis/index.js';
import type { KindDefinition, Diagnostic } from '../../specs/ts-ast/kind-checking/types.js';
import type { KSCompilationUnit } from '../../generated/ts-ast/grammar/index.js';
import type { KSTree } from '../../generated/ts-ast/grammar/convert.js';

export interface KSProgramInterface {
  getRootFileNames(): string[];
  getCompilationUnits(): KSCompilationUnit[];
  getKindDefinitions(): KindDefinition[];
  getDiagnostics(): Diagnostic[];
  getKSTree(): KSTree;
  getAttributeDepGraph(): AttributeDepGraph;
}
