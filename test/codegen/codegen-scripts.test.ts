/**
 * Integration tests for codegen scripts.
 *
 * Verifies that the analysis codegen pipeline executes successfully.
 */
import { describe, it, expect } from 'vitest';

import { compileAnalysis, validateSpec } from '@kindscript/core-codegen';
import { analysisDecl } from '../../src/adapters/analysis/spec/ts-kind-checking/spec.js';
import { grammar } from '../../src/adapters/grammar/grammar/ts-ast/index.js';

describe('codegen pipeline', () => {
  it('spec validation passes with real specs', () => {
    const diags = validateSpec(analysisDecl);

    const errors = diags.filter(d => d.level === 'error');
    expect(errors).toEqual([]);
  });

  it('compileAnalysis produces dispatch and attr-types', () => {
    const result = compileAnalysis(grammar, analysisDecl);

    expect(result.dispatchFile.path).toBe('dispatch.ts');
    expect(result.attrTypesFile.path).toBe('attr-types.ts');
    expect(result.dispatchFile.content.length).toBeGreaterThan(0);
    expect(result.attrTypesFile.content.length).toBeGreaterThan(0);
    expect(result.attrs.length).toBe(12);
    expect(result.depGraph.order.length).toBe(12);
    expect(result.depGraph.edges.length).toBe(9);
  });

  it('compileAnalysis uses custom specImportPath', () => {
    const result = compileAnalysis(grammar, analysisDecl, {
      specImportPath: '../specs/ts-ast/kind-checking/spec.js',
    });
    expect(result.dispatchFile.content).toContain(
      "from '../specs/ts-ast/kind-checking/equations/index.js'"
    );
  });
});
