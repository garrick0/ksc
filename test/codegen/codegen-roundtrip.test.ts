/**
 * P3-18: Codegen roundtrip test.
 *
 * Verifies that re-running compileAnalysis with the same import paths
 * produces output structurally identical to the committed generated files.
 * Catches stale generated files.
 *
 * Note: vitest's bundler (esbuild) appends numeric suffixes to function
 * names when a variable and its inner function share the same name
 * (e.g., eq_kindDefs_default becomes eq_kindDefs_default2 at runtime).
 * We normalize these suffixes before comparison so the roundtrip check
 * is not affected by bundler artifacts.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { compileAnalysis } from '@ksc/behavior/index.js';
import { tsGrammar as grammar } from '../compose.js';
import { analysisDecl } from '@ksc/analysis-ts-kind-checking';

const ROOT = path.resolve(import.meta.dirname!, '../..');
const GENERATED_DIR = path.join(ROOT, 'libs', 'analyses', 'ts-kind-checking', 'src', 'generated');

/**
 * The same import paths used by apps/cli/codegen/targets.ts.
 * If those change, this test must be updated in sync.
 */
const generatedImports = {
  specImportPath: '../spec.js',
  grammarImportPath: '@ksc/language-ts-ast/grammar/index.js',
  evaluatorImportPath: '@ksc/evaluation/index.js',
};

/**
 * Strip numeric suffixes that bundlers add to deduplicate identifiers.
 * e.g., "eq_kindDefs_default2" → "eq_kindDefs_default"
 *
 * Only strips trailing digits from identifiers that start with "eq_".
 */
function normalizeBundlerNames(content: string): string {
  return content.replace(/\beq_(\w+?)(\d+)\b/g, 'eq_$1');
}

describe('codegen roundtrip — committed files match fresh compilation', () => {
  const result = compileAnalysis(grammar, analysisDecl, generatedImports);

  it('dispatch.ts matches committed file', () => {
    const committedDispatch = fs.readFileSync(
      path.join(GENERATED_DIR, 'dispatch.ts'),
      'utf-8',
    );
    expect(normalizeBundlerNames(result.dispatchFile.content))
      .toBe(normalizeBundlerNames(committedDispatch));
  });

  it('attr-types.ts matches committed file', () => {
    const committedAttrTypes = fs.readFileSync(
      path.join(GENERATED_DIR, 'attr-types.ts'),
      'utf-8',
    );
    expect(result.attrTypesFile.content).toBe(committedAttrTypes);
  });

  it('dispatch.ts has correct number of dispatch entries', () => {
    const committedDispatch = fs.readFileSync(
      path.join(GENERATED_DIR, 'dispatch.ts'),
      'utf-8',
    );
    // Count dispatch config entries in both
    const countEntries = (content: string) =>
      (content.match(/^\s+\w+:\s*\{\s*direction:/gm) || []).length;
    expect(countEntries(result.dispatchFile.content))
      .toBe(countEntries(committedDispatch));
  });

  it('dep-graph.ts matches committed file', () => {
    const committedDepGraph = fs.readFileSync(
      path.join(GENERATED_DIR, 'dep-graph.ts'),
      'utf-8',
    );
    expect(result.depGraphFile.content).toBe(committedDepGraph);
  });

  it('dispatch.ts references same equation function names', () => {
    const committedDispatch = fs.readFileSync(
      path.join(GENERATED_DIR, 'dispatch.ts'),
      'utf-8',
    );
    // Extract imported equation names from committed file
    const importBlock = committedDispatch.match(/import \{([^}]+)\} from.*equations/s);
    expect(importBlock).not.toBeNull();
    const committedNames = importBlock![1]
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    // Each committed name should appear (possibly with suffix) in generated
    for (const name of committedNames) {
      const pattern = normalizeBundlerNames(name);
      expect(normalizeBundlerNames(result.dispatchFile.content)).toContain(pattern);
    }
  });
});
