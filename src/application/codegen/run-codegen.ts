/**
 * Use case: Run codegen pipeline — validate spec, compile analysis, write files.
 *
 * Pipeline stages:
 *   1. Grammar metadata (provided via CodegenTarget)
 *   2. Spec validation (attr dep consistency)
 *   3. Analysis compilation (spec → dispatch + attr-types + dep-graph)
 *   4. File output
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { compileAnalysis, validateSpec } from '@kindscript/core-codegen';
import type { CodegenTarget, GeneratedFile, CompiledAttrDef, ValidationDiagnostic } from '@kindscript/core-codegen';
import type { AttributeDepGraph } from '@kindscript/core-codegen';

// ── Result types ────────────────────────────────────────────────────

export interface WrittenFile {
  path: string;
  lineCount: number;
}

export interface CodegenResult {
  ok: true;
  grammarSummary: { kindCount: number; sumTypeCount: number };
  validationDiagnostics: ValidationDiagnostic[];
  warnings: string[];
  writtenFiles: WrittenFile[];
  attrs: CompiledAttrDef[];
  depGraph: AttributeDepGraph;
}

export interface CodegenFailure {
  ok: false;
  validationDiagnostics: ValidationDiagnostic[];
}

export type CodegenPipelineResult = CodegenResult | CodegenFailure;

// ── File output ─────────────────────────────────────────────────────

function writeFiles(dir: string, files: GeneratedFile[]): WrittenFile[] {
  fs.mkdirSync(dir, { recursive: true });
  const written: WrittenFile[] = [];
  for (const file of files) {
    const outPath = path.join(dir, file.path);
    fs.writeFileSync(outPath, file.content, 'utf-8');
    written.push({ path: file.path, lineCount: file.content.split('\n').length });
  }
  return written;
}

// ── Pipeline ────────────────────────────────────────────────────────

/**
 * Run the codegen pipeline: validate → compile → write.
 * Returns structured results for the CLI to format.
 */
export function runCodegenPipeline(target: CodegenTarget): CodegenPipelineResult {
  const { grammar, decl, outputDir, generatedImports } = target;

  // Stage 1: Spec validation (deps only — grammar-aware validation runs inside compileAnalysis)
  const validationDiagnostics = validateSpec(decl);
  if (validationDiagnostics.some(d => d.level === 'error')) {
    return { ok: false, validationDiagnostics };
  }

  // Check for missing equation files
  const warnings: string[] = [];
  if (generatedImports?.specImportPath) {
    const specImportPath = generatedImports.specImportPath;
    const equationsPath = generatedImports.equationsImportPath
      ?? specImportPath.replace(/\/spec\.js$/, '/equations/index.js');
    const resolvedEq = path.resolve(outputDir, equationsPath.replace(/\.js$/, '.ts'));
    if (!fs.existsSync(resolvedEq)) {
      warnings.push(`Equations file not found: ${resolvedEq} (derived from specImportPath: ${specImportPath})`);
    }
  }

  // Stage 2: Analysis compilation + file output
  const result = compileAnalysis(grammar, decl, generatedImports);
  const writtenFiles = writeFiles(outputDir, [
    result.dispatchFile,
    result.attrTypesFile,
    result.depGraphFile,
  ]);

  return {
    ok: true,
    grammarSummary: {
      kindCount: grammar.allKinds.size,
      sumTypeCount: Object.keys(grammar.sumTypeMembers).length,
    },
    validationDiagnostics,
    warnings,
    writtenFiles,
    attrs: result.attrs,
    depGraph: result.depGraph,
  };
}
