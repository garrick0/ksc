/**
 * Unit tests for compileAnalysis — the core codegen compilation function.
 */
import { describe, it, expect } from 'vitest';
import { compileAnalysis, code, withDeps } from '@ksc/behavior/index.js';
import type { AnalysisDecl, AttrDecl } from '@ksc/behavior/index.js';
import type { Grammar } from '@ksc/grammar/index.js';

const minGrammar: Grammar = {
  fieldDefs: {},
  allKinds: new Set(),
  fileContainerKind: 'Root',
  fileNameField: 'fileName',
  sumTypeMembers: {},
  sumTypeMembership: {},
};

function grammarWithKinds(allKinds: Set<string>, fileContainerKind = 'Alpha'): Grammar {
  return { ...minGrammar, allKinds, fileContainerKind };
}

const eq_noFooContext_root = withDeps(['testAttr'], function eq_noFooContext_root() { return null; });
const eq_fooViolation_default = withDeps(['noFooContext'], function eq_fooViolation_default() { return null; });
const eq_allViolations_default = withDeps(['fooViolation'], function eq_allViolations_default() { return []; });

function makeMinimalSpec(): AnalysisDecl {
  return {
    attrs: [
      { name: 'testAttr', direction: 'syn', type: 'string', default: code("'hello'") },
      { name: 'noFooContext', direction: 'inh', type: 'KindDefinition | null', rootValue: eq_noFooContext_root },
      { name: 'fooViolation', direction: 'syn', type: 'Diagnostic | null', default: eq_fooViolation_default },
      { name: 'allViolations', direction: 'syn', type: 'Diagnostic[]', default: eq_allViolations_default },
    ],
  };
}

describe('compileAnalysis — minimal spec', () => {
  const spec = makeMinimalSpec();
  const result = compileAnalysis(minGrammar, spec);

  it('produces dispatch.ts and attr-types.ts with correct attr count', () => {
    expect(result.dispatchFile.path).toBe('dispatch.ts');
    expect(result.attrTypesFile.path).toBe('attr-types.ts');
    expect(result.attrs).toHaveLength(4);
  });

  it('builds correct dep graph from withDeps metadata', () => {
    expect(result.depGraph.edges).toContainEqual(['fooViolation', 'noFooContext']);
    expect(result.depGraph.edges).toContainEqual(['allViolations', 'fooViolation']);
  });

  it('attr-types.ts contains KSCAttrMap interface with correct types', () => {
    const content = result.attrTypesFile.content;
    expect(content).toContain('export interface KSCAttrMap');
    expect(content).toContain('testAttr: string');
    expect(content).toContain('noFooContext: KindDefinition | null');
    expect(content).toContain('fooViolation: Diagnostic | null');
    expect(content).toContain('allViolations: Diagnostic[]');
  });

  it('dispatch.ts auto-generates equation imports with AUTO-GENERATED header', () => {
    const content = result.dispatchFile.content;
    expect(content).toContain('AUTO-GENERATED');
    expect(content).toContain('eq_noFooContext_root');
    expect(content).toContain('eq_fooViolation_default');
    expect(content).toContain('eq_allViolations_default');
  });
});

describe('compileAnalysis — collection attributes', () => {
  it('handles collection attrs', () => {
    const spec: AnalysisDecl = {
      attrs: [{
        name: 'count', direction: 'collection', type: 'number',
        init: 1, combine: code('(acc: number, c: number) => acc + c'),
      }],
    };
    const result = compileAnalysis(minGrammar, spec);
    expect(result.attrs.find(a => a.name === 'count')!.direction).toBe('collection');
  });
});

describe('compileAnalysis — parameterized attributes', () => {
  it('generates dispatch for parameterized attrs and excludes from KSCAttrMap', () => {
    const spec: AnalysisDecl = {
      attrs: [
        { name: 'simple', direction: 'syn', type: 'number', default: 0 },
        {
          name: 'paramAttr', direction: 'syn', type: 'string',
          parameter: { name: 'key', type: 'string' }, default: code("''"),
        },
      ],
    };
    const result = compileAnalysis(minGrammar, spec);
    expect(result.dispatchFile.content).toContain("paramAttr: { direction: 'syn'");
    expect(result.attrTypesFile.content).toContain('simple: number');
    expect(result.attrTypesFile.content).not.toContain('paramAttr');
  });
});

describe('compileAnalysis — exhaustive switch generation', () => {
  const allKinds = new Set(['Alpha', 'Beta', 'Gamma']);
  const g = grammarWithKinds(allKinds);

  it('generates exhaustive switch with _exhaustive: never for syn attr', () => {
    const eq = withDeps([], function eq_test_Alpha() { return 'a'; });
    const spec: AnalysisDecl = {
      attrs: [{ name: 'test', direction: 'syn', type: 'string', default: code("'x'"), equations: { Alpha: eq } }],
    };
    const content = compileAnalysis(g, spec).dispatchFile.content;
    expect(content).toContain('const _exhaustive: never = _kind;');
    expect(content).toContain("case 'Alpha':");
    expect(content).toContain("case 'Beta':");
    expect(content).toContain("case 'Gamma':");
  });

  it('generates exhaustive switch for inh parentEquations', () => {
    const eq = withDeps([], function eq_inh_Alpha() { return 'override'; });
    const spec: AnalysisDecl = {
      attrs: [{ name: 'ctx', direction: 'inh', type: 'string | null', rootValue: null, parentEquations: { Alpha: eq } }],
    };
    const content = compileAnalysis(g, spec).dispatchFile.content;
    expect(content).toContain('const _exhaustive: never = _pKind;');
  });

  it('does NOT generate exhaustive switch without allKinds', () => {
    const eq = withDeps([], function eq_test_NoExh() { return 'a'; });
    const spec: AnalysisDecl = {
      attrs: [{ name: 'test', direction: 'syn', type: 'string', default: code("'x'"), equations: { Alpha: eq } }],
    };
    const content = compileAnalysis(grammarWithKinds(new Set()), spec).dispatchFile.content;
    expect(content).not.toContain('_exhaustive');
  });

  it('generates KindCtx casts for per-kind syn equations', () => {
    const eq = withDeps([], function eq_test_Alpha() { return 'a'; });
    const spec: AnalysisDecl = {
      attrs: [{ name: 'test', direction: 'syn', type: 'string', default: code("'x'"), equations: { Alpha: eq } }],
    };
    const content = compileAnalysis(g, spec).dispatchFile.content;
    expect(content).toContain("ctx as unknown as KindCtx<KindToNode['Alpha']>");
  });
});

describe('compileAnalysis — exhaustive syn attrs (no default)', () => {
  const allKinds = new Set(['Alpha', 'Beta', 'Gamma']);
  const g = grammarWithKinds(allKinds);

  it('accepts syn attr without default when equations cover all kinds', () => {
    const eqA = withDeps([], function eq_exh_Alpha() { return 'a'; });
    const eqB = withDeps([], function eq_exh_Beta() { return 'b'; });
    const eqG = withDeps([], function eq_exh_Gamma() { return 'g'; });
    const spec: AnalysisDecl = {
      attrs: [{ name: 'test', direction: 'syn', type: 'string', equations: { Alpha: eqA, Beta: eqB, Gamma: eqG } }],
    };
    expect(compileAnalysis(g, spec).attrs).toHaveLength(1);
  });

  it('rejects syn attr without default when equations are incomplete', () => {
    const eqA = withDeps([], function eq_miss_Alpha() { return 'a'; });
    const spec: AnalysisDecl = {
      attrs: [{ name: 'test', direction: 'syn', type: 'string', equations: { Alpha: eqA } }],
    };
    expect(() => compileAnalysis(g, spec)).toThrow(/missing equations for 2 kinds/);
  });

  it('rejects syn attr without default and without equations', () => {
    const spec: AnalysisDecl = {
      attrs: [{ name: 'test', direction: 'syn', type: 'string' }],
    };
    expect(() => compileAnalysis(g, spec)).toThrow(/no default and no equations/);
  });
});
