/**
 * Shared codegen helpers and CLI runner.
 *
 * Used by composition roots (app/codegen/ts-kind-checking.ts, app/codegen/mock.ts, etc.)
 * to wire pure compilation functors to disk IO.
 */

import * as fs from 'fs';
import * as path from 'path';

import { compileGrammar } from '../../../grammar/compile.js';
import { compileAnalysis } from '../../../analysis/compile.js';
import type { CompileAnalysisOpts } from '../../../analysis/compile.js';
import { validateSpec } from '../../../analysis/validate.js';
import type { GrammarSpec, CompiledGrammar, GeneratedFile } from '../../../grammar/types.js';
import type { AnalysisSpec } from '../../../analysis/types.js';
import type { NodeEntry, SumTypeEntry } from '../../../grammar/builder.js';

// ── Verify result type (matches specs/ts-ast/grammar/verify.ts) ─────

interface VerifyResult {
  diagnostics: Array<{ level: 'error' | 'warning'; section: string; message: string }>;
  stats: {
    tsSyntaxKindCount: number; ourNodeCount: number; kscOnlyCount: number;
    tsCoveredCount: number; sumTypeCount: number; fieldCheckCount: number;
    complexNodeCount: number;
    exprMatches: number; exprMismatches: number;
    stmtMatches: number; stmtMismatches: number;
    typeMatches: number; typeMismatches: number;
  };
  hasErrors: boolean;
}

export type GrammarVerifier = (
  nodes: ReadonlyMap<string, NodeEntry>,
  sumTypes: ReadonlyMap<string, SumTypeEntry>,
) => VerifyResult;

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

// ── Pipeline Steps ───────────────────────────────────────────────────

/** Functor 1: compile grammar spec → write AST files to grammarOutputDir. */
export function generateGrammar(grammarOutputDir: string, spec: GrammarSpec): CompiledGrammar {
  console.log('=== Functor 1: Grammar Compilation ===\n');
  console.log(`Schema: ${spec.nodes.size} nodes, ${spec.sumTypes.size} sum types`);

  const result = compileGrammar(spec);
  writeFiles(grammarOutputDir, result.files);

  return result;
}

/**
 * Functor 2: validate then compile analysis spec.
 *
 * Takes the CompiledGrammar from generateGrammar — making the pipeline
 * dependency explicit in the type signature. Returns false on validation errors.
 */
export function generateAnalysis(
  analysisOutputDir: string,
  spec: AnalysisSpec,
  _grammar: CompiledGrammar,
  compileOpts: CompileAnalysisOpts,
): boolean {
  // Spec self-validation (attr dep consistency)
  console.log('=== Spec Validation ===\n');
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

  // Compilation
  console.log('\n=== Functor 2: Analysis Compilation ===\n');

  const result = compileAnalysis(spec, compileOpts);
  writeFiles(analysisOutputDir, [
    result.evaluatorFile,
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

/** Verify grammar spec using the provided verifier. Returns false on errors. */
export function runVerify(spec: GrammarSpec, verifier: GrammarVerifier): boolean {
  const result = verifier(spec.nodes, spec.sumTypes);

  console.log('1. Kind coverage check...');
  const coverageDiags = result.diagnostics.filter(d => d.section === 'coverage');
  const coverageErrors = coverageDiags.filter(d => d.level === 'error');
  const coverageWarnings = coverageDiags.filter(d => d.level === 'warning');
  if (coverageErrors.length > 0) {
    console.error(`  ERROR: Missing ${coverageErrors.length} TypeScript SyntaxKinds from our schema:`);
    for (const d of coverageErrors) console.error(`    - ${d.message.replace('Missing TypeScript SyntaxKind: ', '')}`);
  }
  if (coverageWarnings.length > 0) {
    console.warn(`  WARN: ${coverageWarnings.length} kinds in our schema not in TypeScript SyntaxKind:`);
    for (const d of coverageWarnings) console.warn(`    - ${d.message.replace(/Kind '(.+)' in our schema.*/, '$1')}`);
  }
  const { stats } = result;
  console.log(`  TypeScript SyntaxKinds: ${stats.tsSyntaxKindCount}`);
  console.log(`  Our schema nodes: ${stats.ourNodeCount} (${stats.kscOnlyCount} KSC-only)`);
  console.log(`  Coverage: ${stats.tsCoveredCount}/${stats.tsSyntaxKindCount} TS kinds covered`);

  console.log('\n2. Sum type checks...');
  for (const d of result.diagnostics.filter(d => d.section === 'sumTypes')) {
    console.log(`  ${d.level === 'error' ? 'ERROR' : 'WARN'}: ${d.message}`);
  }
  console.log(`  ${stats.sumTypeCount} sum types checked`);

  console.log('\n3. Field reference validation...');
  for (const d of result.diagnostics.filter(d => d.section === 'fields')) {
    console.log(`  ${d.level === 'error' ? 'ERROR' : 'WARN'}: ${d.message}`);
  }
  console.log(`  ${stats.fieldCheckCount} fields across ${stats.complexNodeCount} complex nodes validated`);

  console.log('\n4. Expression/Statement membership vs ts.is*() guards...');
  for (const d of result.diagnostics.filter(d => d.section === 'membership')) {
    console.log(`  WARN: ${d.message}`);
  }
  console.log(`  Expression: ${stats.exprMatches} matches, ${stats.exprMismatches} mismatches`);
  console.log(`  Statement: ${stats.stmtMatches} matches, ${stats.stmtMismatches} mismatches`);
  console.log(`  TypeNode: ${stats.typeMatches} matches, ${stats.typeMismatches} mismatches`);

  const errorCount = result.diagnostics.filter(d => d.level === 'error').length;
  const warnCount = result.diagnostics.filter(d => d.level === 'warning').length;
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`Verification complete: ${errorCount} errors, ${warnCount} warnings`);

  return !result.hasErrors;
}

// ── CLI Runner ───────────────────────────────────────────────────────

export interface CodegenConfig {
  /** Absolute path of the calling script (for isMain check). */
  callerFilePath: string;
  /** Where grammar output files are written. */
  grammarOutputDir: string;
  /** Where analysis output files (evaluator, attr-types) are written. */
  analysisOutputDir: string;
  grammarSpec: GrammarSpec;
  analysisSpec: AnalysisSpec;
  /** Import paths baked into generated evaluator/attr-types source code. */
  generatedImports: CompileAnalysisOpts;
  /** Spec-provided grammar verifier function. When set, enables the 'verify' command. */
  verifier?: GrammarVerifier;
}

/**
 * Shared CLI runner for codegen composition roots.
 *
 * Checks whether the calling script is the main entry point,
 * parses process.argv[2], and runs the appropriate pipeline stage.
 * Does nothing if the script was imported rather than run directly.
 */
export function runCodegenCLI(config: CodegenConfig): void {
  const {
    callerFilePath, grammarOutputDir, analysisOutputDir,
    grammarSpec, analysisSpec, generatedImports,
    verifier,
  } = config;

  const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(callerFilePath);
  if (!isMain) return;

  const command = process.argv[2] ?? 'all';

  const validCommands = verifier
    ? 'grammar|analysis|all|verify'
    : 'grammar|analysis|all';

  switch (command) {
    case 'grammar':
      generateGrammar(grammarOutputDir, grammarSpec);
      break;
    case 'analysis': {
      const grammar = generateGrammar(grammarOutputDir, grammarSpec);
      if (!generateAnalysis(analysisOutputDir, analysisSpec, grammar, generatedImports))
        process.exit(1);
      break;
    }
    case 'all': {
      const grammar = generateGrammar(grammarOutputDir, grammarSpec);
      if (!generateAnalysis(analysisOutputDir, analysisSpec, grammar, generatedImports))
        process.exit(1);
      console.log('\nDone!');
      break;
    }
    case 'verify':
      if (!verifier) {
        console.error(`Unknown command: ${command}`);
        console.error(`Valid commands: ${validCommands}`);
        process.exit(1);
      }
      if (!runVerify(grammarSpec, verifier)) process.exit(1);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error(`Valid commands: ${validCommands}`);
      process.exit(1);
  }
}
