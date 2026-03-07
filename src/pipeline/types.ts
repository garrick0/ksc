/**
 * App-level type definitions for KindScript.
 */

import type { KindDefinition, CheckerDiagnostic, AttributeDepGraph } from '../../ksc-behavior/index.js';
import type { KSCompilationUnit } from '../../ast-schema/generated/index.js';
import type { KSTree } from '../../ast-schema/generated/convert.js';

export interface KSProgramInterface {
  getRootFileNames(): string[];
  getCompilationUnits(): KSCompilationUnit[];
  getKindDefinitions(): KindDefinition[];
  getDiagnostics(): CheckerDiagnostic[];
  getKSTree(): KSTree;
  getAttributeDepGraph(): AttributeDepGraph;
}
