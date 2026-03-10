/**
 * Analysis codegen pipeline — Composition Root infrastructure.
 *
 * Orchestrates the build-time pipeline stages:
 *   1. Grammar metadata (provided by composition root via CodegenTarget)
 *   2. Spec validation (attr dep consistency)
 *   3. Analysis compilation (spec → dispatch + attr-types)
 *   4. File output
 *
 * Used by composition roots (ts-kind-checking.ts, mock.ts).
 */

import * as fs from 'fs';
import * as path from 'path';

import { compileAnalysis, validateSpec, validateSpecConsistency } from '../../../analysis/index.js';
import type { CodegenTarget, GeneratedFile } from '../../../analysis/index.js';

// ── Shared IO ────────────────────────────────────────────────────────

export function writeFiles(dir: string, files: GeneratedFile[]): void {
  fs.mkdirSync(dir, { recursive: true });
  for (const file of files) {
    const outPath = path.join(dir, file.path);
    fs.writeFileSync(outPath, file.content, 'utf-8');
    const lineCount = file.content.split('\n').length;
    console.log(`  Generated ${file.path} (${lineCount} lines)`);
  }
}

// ── Pipeline ─────────────────────────────────────────────────────────

/**
 * Codegen pipeline configuration — extends CodegenTarget with CLI metadata.
 *
 * CodegenTarget (the port) defines the grammar + spec + output contract.
 * CodegenPipeline adds the callerFilePath needed for CLI detection.
 */
export interface CodegenPipeline extends CodegenTarget {
  callerFilePath: string;
}

/**
 * Run the codegen pipeline: validate → compile → write.
 * Returns false on validation errors.
 */
export function runCodegenPipeline(pipeline: CodegenPipeline): boolean {
  const { grammar, spec, outputDir, generatedImports } = pipeline;

  // Stage 1: Grammar summary
  console.log('=== Grammar ===\n');
  console.log(`  ${grammar.allKinds.size} node kinds, ${Object.keys(grammar.sumTypeMembers).length} sum types`);

  // Stage 2: Spec validation (deps + grammar-aware consistency)
  console.log('\n=== Spec Validation ===\n');
  const diags = validateSpec(spec);
  if (diags.length === 0) {
    console.log('  All attribute dependencies are valid.');
  } else {
    for (const d of diags) {
      console.log(`  [${d.level}] ${d.message}`);
    }
    if (diags.some(d => d.level === 'error')) {
      console.error('\nValidation errors found — aborting analysis compilation.');
      return false;
    }
  }
  // Grammar-aware validation (equation kind refs, function names, exhaustiveness)
  validateSpecConsistency(grammar, spec.attrs);

  // Validate that equation and type sibling files exist
  if (generatedImports?.specImportPath) {
    const specImportPath = generatedImports.specImportPath;
    const equationsPath = generatedImports.equationsImportPath
      ?? specImportPath.replace(/\/spec\.js$/, '/equations/index.js');
    const resolvedEq = path.resolve(outputDir, equationsPath.replace(/\.js$/, '.ts'));
    if (!fs.existsSync(resolvedEq)) {
      console.warn(`  [warn] Equations file not found: ${resolvedEq}`);
      console.warn(`         (derived from specImportPath: ${specImportPath})`);
    }
  }

  // Stage 3: Analysis compilation
  console.log('\n=== Analysis Compilation ===\n');

  const result = compileAnalysis(grammar, spec, generatedImports);
  writeFiles(outputDir, [
    result.dispatchFile,
    result.attrTypesFile,
  ]);

  console.log(`\n${result.attrs.length} attributes:`);
  for (const a of result.attrs) {
    console.log(`  ${a.name}: ${a.direction}`);
  }
  console.log(`\nEvaluation order: ${result.depGraph.order.join(', ')}`);
  console.log(`Edges: ${result.depGraph.edges.length}`);
  return true;
}

// ── CLI Runner ───────────────────────────────────────────────────────

/**
 * CLI entry point for codegen composition roots.
 *
 * Runs the pipeline if the script is the main entry point.
 * Does nothing if the script was imported rather than run directly.
 */
export function runCodegenCLI(pipeline: CodegenPipeline): void {
  const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(pipeline.callerFilePath);
  if (!isMain) return;

  const command = process.argv[2] ?? 'all';

  switch (command) {
    case 'all':
      if (!runCodegenPipeline(pipeline))
        process.exit(1);
      console.log('\nDone!');
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Valid commands: all');
      process.exit(1);
  }
}
