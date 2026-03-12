/**
 * CLI command: ksc codegen — run analysis codegen for all targets.
 *
 * Pure command handler — receives all dependencies via the deps parameter.
 * Composition (target wiring) happens in compose/compose-codegen.ts.
 */

import type { ParsedArgs } from '../args.js';
import { EXIT_SUCCESS, EXIT_ERROR } from '../errors.js';
import type { AllCodegenResult, NamedCodegenTarget } from '../../../src/application/codegen/run-all-codegen.js';

// ── Dependency interface ─────────────────────────────────────────────

export interface CodegenCommandDeps {
  runAllCodegen: (targets: NamedCodegenTarget[]) => AllCodegenResult;
  allTargets: NamedCodegenTarget[];
}

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

    console.log('\n=== Spec Validation ===\n');
    if (result.validationDiagnostics.length === 0) {
      console.log('  All attribute dependencies are valid.');
    } else {
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

export async function codegenCommand(_opts: ParsedArgs, deps: CodegenCommandDeps): Promise<number> {
  const results = deps.runAllCodegen(deps.allTargets);
  formatCodegenResults(results);
  return results.allOk ? EXIT_SUCCESS : EXIT_ERROR;
}
