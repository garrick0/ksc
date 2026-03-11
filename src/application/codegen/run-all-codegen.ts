/**
 * Use case: Run all codegen targets.
 *
 * Pure function — receives targets via parameter.
 * Not in the barrel to avoid pulling codegen target adapters
 * into the npm entry point.
 */

import { runCodegenPipeline } from './run-codegen.js';
import type { CodegenTarget } from '@kindscript/core-codegen';
import type { CodegenPipelineResult } from './run-codegen.js';

export interface NamedCodegenTarget {
  name: string;
  target: CodegenTarget;
}

export interface AllCodegenResult {
  targets: Array<{ name: string; result: CodegenPipelineResult }>;
  allOk: boolean;
}

/** Run codegen for all provided targets. Returns structured results. */
export function runAllCodegen(targets: NamedCodegenTarget[]): AllCodegenResult {
  const results: AllCodegenResult['targets'] = [];
  for (const { name, target } of targets) {
    const result = runCodegenPipeline(target);
    results.push({ name, result });
    if (!result.ok) break;
  }
  return {
    targets: results,
    allOk: results.every(t => t.result.ok),
  };
}
