import type { Grammar } from '@ksc/grammar/index.js';
import type { AnalysisDecl } from './AnalysisDecl.js';

/** Import paths emitted into generated files. */
export interface GeneratedImports {
  /** Import path for the analysis spec (used in generated dispatch). */
  specImportPath?: string;
  /** Import path from generated files to grammar output (e.g. '@ksc/grammar/index.js'). */
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
 */
export interface CodegenTarget<K extends string = string> {
  grammar: Grammar<K>;
  decl: AnalysisDecl<K>;
  outputDir: string;
  generatedImports: GeneratedImports;
}
