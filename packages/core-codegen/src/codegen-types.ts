/**
 * Codegen types — interfaces for the analysis codegen pipeline.
 *
 * Types defined here:
 *   - CodegenTarget<K, P> — what a codegen composition root provides
 *   - GeneratedImports    — import path configuration for generated files
 *   - CompiledAnalyzer    — what analysis compilation produces
 */

import type { Grammar } from '@kindscript/core-grammar';
import type { AnalysisDecl, AttrDirection } from './ports.js';
import type { AttributeDepGraph } from '@kindscript/core-grammar';

// ── Generated file output ──

/** A generated output file (path + content). */
export interface GeneratedFile {
  path: string;
  content: string;
}

// ── Codegen target (composition root contract) ──

/** Import paths emitted into generated files. */
export interface GeneratedImports {
  /** Import path for the analysis spec (used in generated dispatch). */
  specImportPath?: string;
  /** Import path from generated files to grammar output (e.g. '../grammar/index.js'). */
  grammarImportPath?: string;
  /** Import path from generated files to analysis/ machinery (e.g. '../../../analysis'). */
  analysisImportPath?: string;
  /** Import path from generated files to evaluator/ module (e.g. '../../../evaluator'). */
  evaluatorImportPath?: string;
  /** Import path for equation functions. Defaults to specImportPath with '/spec.js' replaced by '/equations/index.js'. */
  equationsImportPath?: string;
}

/**
 * Port: CodegenTarget — what a codegen composition root provides to the pipeline.
 *
 * Bundles the grammar + analysis declaration + output configuration that the
 * codegen pipeline needs to generate dispatch functions and attr-type maps.
 *
 * Uses AnalysisDecl — codegen only needs attribute declarations and
 * type imports, not runtime projections (AnalysisProjections).
 */
export interface CodegenTarget<K extends string = string> {
  grammar: Grammar<K>;
  decl: AnalysisDecl<K>;
  outputDir: string;
  generatedImports: GeneratedImports;
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
