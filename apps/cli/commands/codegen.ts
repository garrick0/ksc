/**
 * CLI command: ksc codegen — run analysis codegen for all targets.
 *
 * This module acts as the Bridge: it receives ParsedArgs from the Shell (harness),
 * pulls wired targets from Setup (wiring), and executes the Codegen use case.
 */

import type { ParsedArgs } from '../harness/args.js';
import { EXIT_SUCCESS, EXIT_ERROR } from '../harness/errors.js';
import { runAllCodegen } from '@ksc/behavior/application/run-all-codegen.js';
import { allTargets } from '../wiring/codegen/targets.js';
import type { AllCodegenResult } from '@ksc/behavior/application/run-all-codegen.js';

// ── Formatting ───────────────────────────────────────────────────────

function formatCodegenResults(results: AllCodegenResult): void {
  for (const { name, result } of results.targets) {
    console.log(`\n========== Codegen: ${name} ==========\n`);

    if (!result.ok) {
      console.log('=== Spec Validation ===\n');
      for (const d of result.validationDiagnostics) {
        console.log(`  [${d.level}] ${d.message}`);
      }
      console.error('\nValidation errors found — aborting analysis compilation.');
      return;
    }

    console.log('=== Grammar ===\n');
    console.log(`  ${result.grammarSummary.kindCount} node kinds, ${result.grammarSummary.sumTypeCount} sum types`);

    if (result.validationDiagnostics.length > 0) {
      console.log('\n=== Spec Validation ===\n');
      for (const d of result.validationDiagnostics) {
        console.log(`  [${d.level}] ${d.message}`);
      }
    }

    for (const w of result.warnings) {
      console.warn(`  [warn] ${w}`);
    }

    console.log('\n=== Analysis Compilation ===\n');
    for (const f of result.writtenFiles) {
      console.log(`  Generated ${f.path} (${f.lineCount} lines)`);
    }

    console.log(`\n${result.attrs.length} attributes:`);
    for (const a of result.attrs) {
      console.log(`  ${a.name}: ${a.direction}`);
    }
    console.log(`\nEvaluation order: ${result.depGraph.order.join(', ')}`);
    console.log(`Edges: ${result.depGraph.edges.length}`);
  }

  if (results.allOk) {
    console.log('\nAll codegen targets complete.');
  }
}

// ── Command handler ──────────────────────────────────────────────────

/**
 * Command handler: codegen
 * Executes the codegen pipeline for all configured targets.
 */
export async function codegenCommand(_opts: ParsedArgs): Promise<number> {
  const results = runAllCodegen(allTargets);
  formatCodegenResults(results);
  return results.allOk ? EXIT_SUCCESS : EXIT_ERROR;
}
