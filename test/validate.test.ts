/**
 * Tests for spec validation (attribute dep consistency).
 */
import { describe, it, expect } from 'vitest';
import { validateSpec } from '../analysis/validate.js';
import type { AnalysisSpec, AttrDecl } from '../analysis/types.js';
import { code, withDeps } from '../analysis/types.js';

function makeSpec(attrs: AttrDecl[]): AnalysisSpec {
  return {
    attrs,
    projections: { definitions: () => [], diagnostics: () => [] },
    grammarConfig: { rootKind: 'Root', fileNameField: 'fileName' },
  };
}

describe('validateSpec', () => {
  it('returns no diagnostics for valid spec', () => {
    const eq_b = withDeps(['a'], function eq_b() { return 'y'; });
    const spec = makeSpec([
      { name: 'a', direction: 'syn', type: 'string', default: code("'x'") },
      { name: 'b', direction: 'syn', type: 'string', default: eq_b },
    ]);
    const diags = validateSpec(spec);
    expect(diags).toHaveLength(0);
  });

  it('reports error for unknown dep reference', () => {
    const eq_a = withDeps(['nonexistent'], function eq_a() { return 'x'; });
    const spec = makeSpec([
      { name: 'a', direction: 'syn', type: 'string', default: eq_a },
    ]);
    const diags = validateSpec(spec);
    expect(diags).toHaveLength(1);
    expect(diags[0].level).toBe('error');
    expect(diags[0].message).toContain('nonexistent');
    expect(diags[0].message).toContain("'a'");
  });

  it('reports multiple errors', () => {
    const eq_a = withDeps(['bad1'], function eq_a() { return null; });
    const eq_b = withDeps(['bad2'], function eq_b() { return null; });
    const spec = makeSpec([
      { name: 'a', direction: 'syn', type: 'string', default: eq_a },
      { name: 'b', direction: 'syn', type: 'string', default: eq_b },
    ]);
    const diags = validateSpec(spec);
    expect(diags).toHaveLength(2);
  });

  it('handles empty spec', () => {
    const spec = makeSpec([]);
    const diags = validateSpec(spec);
    expect(diags).toHaveLength(0);
  });
});
