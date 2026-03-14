/**
 * Integration tests for the codegen pipeline with real specs.
 */
import { describe, it, expect } from 'vitest';

import { compileAnalysis } from '@ksc/behavior/index.js';
import { analysisDecl } from '@ksc/analysis-ts-kind-checking';
import { tsGrammar as grammar } from '../compose.js';

describe('codegen pipeline', () => {
  it('compileAnalysis produces dispatch and attr-types with correct counts', () => {
    const result = compileAnalysis(grammar, analysisDecl);

    expect(result.dispatchFile.path).toBe('dispatch.ts');
    expect(result.attrTypesFile.path).toBe('attr-types.ts');
    expect(result.dispatchFile.content.length).toBeGreaterThan(0);
    expect(result.attrTypesFile.content.length).toBeGreaterThan(0);
    expect(result.attrs.length).toBe(14);
    expect(result.depGraph.order.length).toBe(14);
    expect(result.depGraph.edges.length).toBe(12);
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
