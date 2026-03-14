/**
 * Codegen types — interfaces for the analysis codegen pipeline.
 *
 * Types defined here:
 *   - CodegenTarget<K, P> — what a codegen composition root provides
 *   - GeneratedImports    — import path configuration for generated files
 *   - CompiledAnalyzer    — what analysis compilation produces
 */

import type { Grammar } from '@ksc/grammar/index.js';
import type { AnalysisDecl, AttrDirection } from './ports.js';
import type { AttributeDepGraph } from '@ksc/grammar/index.js';
import type { CodegenTarget, GeneratedImports } from '../application/ports/CodegenTarget.js';

export type { CodegenTarget, GeneratedImports };

// ── Generated file output ──

/** A generated output file (path + content). */
export interface GeneratedFile {
  path: string;
  content: string;
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
  depGraphFile: GeneratedFile;
  attrs: CompiledAttrDef[];
  depGraph: AttributeDepGraph;
}
