/**
 * Unit tests for Functor 2: compileAnalysis
 *
 * Tests the pure compilation function with minimal analysis specs.
 * Attribute method bodies are generated from direction-typed declarations.
 * Dependencies are inferred from withDeps() on equation function references.
 */
import { describe, it, expect } from 'vitest';
import { compileAnalysis, code, withDeps } from '@kindscript/core-codegen';
import type { AnalysisDecl, AttrDecl } from '@kindscript/core-codegen';
import type { Grammar } from '@kindscript/core-grammar';

/** Minimal grammar for tests that don't need exhaustive checking. */
const minGrammar: Grammar = {
  fieldDefs: {},
  allKinds: new Set(),
  fileContainerKind: 'Root',
  fileNameField: 'fileName',
  sumTypeMembers: {},
  sumTypeMembership: {},
};

/** Grammar with a specific set of kinds for exhaustive checking. */
function grammarWithKinds(allKinds: Set<string>, fileContainerKind = 'Alpha'): Grammar {
  return { ...minGrammar, allKinds, fileContainerKind };
}

// Test equation functions with deps metadata
const eq_noFooContext_root = withDeps(['testAttr'],
  function eq_noFooContext_root() { return null; }
);
const eq_fooViolation_default = withDeps(['noFooContext'],
  function eq_fooViolation_default() { return null; }
);
const eq_allViolations_default = withDeps(['fooViolation'],
  function eq_allViolations_default() { return []; }
);

function makeMinimalSpec(): AnalysisDecl {
  const attrs: AttrDecl[] = [
    {
      name: 'testAttr',
      direction: 'syn',
      type: 'string',
      default: code("'hello'"),
    },
    {
      name: 'noFooContext',
      direction: 'inh',
      type: 'KindDefinition | null',
      rootValue: eq_noFooContext_root,
    },
    {
      name: 'fooViolation',
      direction: 'syn',
      type: 'Diagnostic | null',
      default: eq_fooViolation_default,
    },
    {
      name: 'allViolations',
      direction: 'syn',
      type: 'Diagnostic[]',
      default: eq_allViolations_default,
    },
  ];

  return { attrs };
}

describe('compileAnalysis — minimal spec', () => {
  const spec = makeMinimalSpec();
  const result = compileAnalysis(minGrammar, spec);

  it('produces dispatch.ts and attr-types.ts', () => {
    expect(result.dispatchFile.path).toBe('dispatch.ts');
    expect(result.attrTypesFile.path).toBe('attr-types.ts');
  });

  it('has correct number of attributes', () => {
    expect(result.attrs).toHaveLength(4);
  });

  it('includes context attr', () => {
    const ctx = result.attrs.find(a => a.name === 'noFooContext');
    expect(ctx).toBeDefined();
    expect(ctx!.direction).toBe('inh');
  });

  it('includes violation attr', () => {
    const viol = result.attrs.find(a => a.name === 'fooViolation');
    expect(viol).toBeDefined();
    expect(viol!.direction).toBe('syn');
  });

  it('includes allViolations (now syn, not collection)', () => {
    const all = result.attrs.find(a => a.name === 'allViolations');
    expect(all).toBeDefined();
    expect(all!.direction).toBe('syn');
  });

  it('builds correct dep graph from withDeps metadata', () => {
    const { depGraph } = result;

    // fooViolation depends on noFooContext
    expect(depGraph.edges).toContainEqual(['fooViolation', 'noFooContext']);

    // allViolations depends on fooViolation
    expect(depGraph.edges).toContainEqual(['allViolations', 'fooViolation']);
  });

  it('topological order has testAttr before derived attrs', () => {
    const { order } = result.depGraph;
    const testIdx = order.indexOf('testAttr');
    expect(testIdx).toBeGreaterThanOrEqual(0);
  });

  it('attr-types.ts contains KSCAttrMap interface', () => {
    const content = result.attrTypesFile.content;
    expect(content).toContain('export interface KSCAttrMap');
    expect(content).toContain('testAttr: string');
    expect(content).toContain('noFooContext: KindDefinition | null');
    expect(content).toContain('fooViolation: Diagnostic | null');
    expect(content).toContain('allViolations: Diagnostic[]');
  });

  it('dispatch.ts contains dispatch config (dep graph computed at runtime)', () => {
    const content = result.dispatchFile.content;
    expect(content).toContain('export const dispatchConfig: DispatchConfig');
    expect(content).not.toContain('depGraph');
  });

  it('dispatch.ts auto-generates equation imports', () => {
    const content = result.dispatchFile.content;
    expect(content).toContain('eq_noFooContext_root');
    expect(content).toContain('eq_fooViolation_default');
    expect(content).toContain('eq_allViolations_default');
    expect(content).toContain('auto-generated from function references');
  });

  it('dispatch.ts has auto-generated header', () => {
    expect(result.dispatchFile.content).toContain('AUTO-GENERATED');
    expect(result.attrTypesFile.content).toContain('AUTO-GENERATED');
  });
});

describe('compileAnalysis — empty spec', () => {
  it('handles spec with no attrs', () => {
    const spec: AnalysisDecl = {
      attrs: [],
    };
    const result = compileAnalysis(minGrammar, spec);
    expect(result.attrs).toHaveLength(0);
  });
});

describe('compileAnalysis — collection attributes', () => {
  it('handles collection attrs', () => {
    const spec: AnalysisDecl = {
      attrs: [
        {
          name: 'count',
          direction: 'collection',
          type: 'number',
          init: 1,
          combine: code('(acc: number, c: number) => acc + c'),
        },
      ],
    };
    const result = compileAnalysis(minGrammar, spec);
    expect(result.attrs).toHaveLength(1);
    const countAttr = result.attrs.find(a => a.name === 'count');
    expect(countAttr).toBeDefined();
    expect(countAttr!.direction).toBe('collection');
  });
});

describe('compileAnalysis — multiple attrs', () => {
  it('builds correct dep graph for multiple attrs', () => {
    const eq_violA = withDeps(['ctxA'], function eq_violA() { return null; });
    const eq_violB = withDeps(['ctxB'], function eq_violB() { return null; });
    const eq_violC = withDeps(['ctxC'], function eq_violC() { return null; });
    const eq_allViols = withDeps(['violA', 'violB', 'violC'], function eq_allViols() { return []; });

    const spec: AnalysisDecl = {
      attrs: [
        { name: 'violA', direction: 'syn', type: 'Diagnostic | null', default: eq_violA },
        { name: 'violB', direction: 'syn', type: 'Diagnostic | null', default: eq_violB },
        { name: 'violC', direction: 'syn', type: 'Diagnostic | null', default: eq_violC },
        { name: 'ctxA', direction: 'inh', type: 'KindDefinition | null', rootValue: null },
        { name: 'ctxB', direction: 'inh', type: 'KindDefinition | null', rootValue: null },
        { name: 'ctxC', direction: 'inh', type: 'KindDefinition | null', rootValue: null },
        {
          name: 'allViolations', direction: 'syn', type: 'Diagnostic[]',
          default: eq_allViols,
        },
      ],
    };
    const result = compileAnalysis(minGrammar, spec);
    expect(result.attrs).toHaveLength(7);

    // allViolations depends on all 3 violations
    const allDeps = result.depGraph.edges
      .filter(([from]) => from === 'allViolations')
      .map(([, to]) => to);
    expect(allDeps).toContain('violA');
    expect(allDeps).toContain('violB');
    expect(allDeps).toContain('violC');
  });
});

describe('compileAnalysis — parameterized attributes', () => {
  it('generates dispatch functions for parameterized attrs', () => {
    const spec: AnalysisDecl = {
      attrs: [
        {
          name: 'contextFor',
          direction: 'inh',
          type: 'string | null',
          parameter: { name: 'property', type: 'string' },
          rootValue: null,
        },
      ],
    };
    const result = compileAnalysis(minGrammar, spec);
    const content = result.dispatchFile.content;
    expect(content).toContain('dispatch_contextFor_root(ctx: Ctx, property: string)');
    expect(content).toContain("contextFor: { direction: 'inh'");
  });

  it('excludes parameterized attrs from KSCAttrMap', () => {
    const spec: AnalysisDecl = {
      attrs: [
        { name: 'simple', direction: 'syn', type: 'number', default: 0 },
        {
          name: 'paramAttr',
          direction: 'syn',
          type: 'string',
          parameter: { name: 'key', type: 'string' },
          default: code("''"),
        },
      ],
    };
    const result = compileAnalysis(minGrammar, spec);
    const attrTypes = result.attrTypesFile.content;
    expect(attrTypes).toContain('simple: number');
    expect(attrTypes).not.toContain('paramAttr');
  });
});

describe('compileAnalysis — exhaustive switch generation', () => {
  const allKinds = new Set(['Alpha', 'Beta', 'Gamma']);
  const g = grammarWithKinds(allKinds);

  it('generates exhaustive switch with _exhaustive: never for syn attr with allKinds', () => {
    const eq = withDeps([], function eq_test_Alpha() { return 'a'; });
    const spec: AnalysisDecl = {
      attrs: [
        { name: 'test', direction: 'syn', type: 'string', default: code("'x'"), equations: { Alpha: eq } },
      ],
    };
    const content = compileAnalysis(g, spec).dispatchFile.content;
    expect(content).toContain('const _kind = (ctx.node as KSNode).kind;');
    expect(content).toContain('const _exhaustive: never = _kind;');
    expect(content).toContain("case 'Alpha':");
    expect(content).toContain("case 'Beta':");
    expect(content).toContain("case 'Gamma':");
  });

  it('generates exhaustive switch for inh attr with parentEquations and allKinds', () => {
    const eq = withDeps([], function eq_inh_Alpha() { return 'override'; });
    const spec: AnalysisDecl = {
      attrs: [
        { name: 'ctx', direction: 'inh', type: 'string | null', rootValue: null, parentEquations: { Alpha: eq } },
      ],
    };
    const content = compileAnalysis(g, spec).dispatchFile.content;
    expect(content).toContain('const _pKind = (ctx.parent!.node as KSNode).kind;');
    expect(content).toContain('const _exhaustive: never = _pKind;');
    expect(content).toContain("case 'Beta':");
    expect(content).toContain("case 'Gamma':");
  });

  it('does NOT generate exhaustive switch without allKinds', () => {
    const eq = withDeps([], function eq_test_NoExh() { return 'a'; });
    const spec: AnalysisDecl = {
      attrs: [
        { name: 'test', direction: 'syn', type: 'string', default: code("'x'"), equations: { Alpha: eq } },
      ],
    };
    // Empty allKinds = no exhaustive checking
    const noKindsGrammar = grammarWithKinds(new Set());
    const content = compileAnalysis(noKindsGrammar, spec).dispatchFile.content;
    expect(content).not.toContain('_exhaustive');
    expect(content).toContain("default: return 'x';");
  });

  it('lists remaining kinds as fall-through cases to default', () => {
    const eq = withDeps([], function eq_test_Beta() { return 'b'; });
    const spec: AnalysisDecl = {
      attrs: [
        { name: 'test', direction: 'syn', type: 'string', default: code("'x'"), equations: { Beta: eq } },
      ],
    };
    const content = compileAnalysis(g, spec).dispatchFile.content;
    // Alpha and Gamma are remaining (not in equations), should appear as fall-through
    expect(content).toContain("case 'Alpha':");
    expect(content).toContain("case 'Gamma':");
    // Beta has an equation
    expect(content).toMatch(/case 'Beta':.*eq_test_Beta/s);
  });

  it('generates exhaustive switch for parameterized syn attr with allKinds', () => {
    const eq = withDeps([], function eq_param_Alpha() { return null; });
    const spec: AnalysisDecl = {
      attrs: [
        {
          name: 'checkFor', direction: 'syn', type: 'string | null',
          parameter: { name: 'prop', type: 'string' },
          default: null, equations: { Alpha: eq },
        },
      ],
    };
    const content = compileAnalysis(g, spec).dispatchFile.content;
    expect(content).toContain('const _kind = (ctx.node as KSNode).kind;');
    expect(content).toContain('const _exhaustive: never = _kind;');
  });

  it('generates KindCtx casts for per-kind syn equations', () => {
    const eq = withDeps([], function eq_test_Alpha() { return 'a'; });
    const spec: AnalysisDecl = {
      attrs: [
        { name: 'test', direction: 'syn', type: 'string', default: code("'x'"), equations: { Alpha: eq } },
      ],
    };
    const content = compileAnalysis(g, spec).dispatchFile.content;
    expect(content).toContain("ctx as unknown as KindCtx<KindToNode['Alpha']>");
    expect(content).toContain("Ctx, KindCtx, DispatchConfig");
    expect(content).toContain("import type { KSNode, KindToNode } from");
  });

  it('does NOT generate KindCtx casts for inh parentEquations', () => {
    const eq = withDeps([], function eq_inh_Alpha() { return 'override'; });
    const spec: AnalysisDecl = {
      attrs: [
        { name: 'ctx', direction: 'inh', type: 'string | null', rootValue: null, parentEquations: { Alpha: eq } },
      ],
    };
    const content = compileAnalysis(g, spec).dispatchFile.content;
    // inh parentEquations should use plain `ctx`, not KindCtx
    expect(content).toContain('eq_inh_Alpha(ctx)');
    expect(content).not.toContain("ctx as unknown as KindCtx<KindToNode['Alpha']>");
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
      attrs: [
        { name: 'test', direction: 'syn', type: 'string', equations: { Alpha: eqA, Beta: eqB, Gamma: eqG } },
      ],
    };
    const result = compileAnalysis(g, spec);
    expect(result.attrs).toHaveLength(1);
  });

  it('generates switch with no default-value fallthrough when no default', () => {
    const eqA = withDeps([], function eq_nodef_Alpha() { return 1; });
    const eqB = withDeps([], function eq_nodef_Beta() { return 2; });
    const eqG = withDeps([], function eq_nodef_Gamma() { return 3; });
    const spec: AnalysisDecl = {
      attrs: [
        { name: 'val', direction: 'syn', type: 'number', equations: { Alpha: eqA, Beta: eqB, Gamma: eqG } },
      ],
    };
    const content = compileAnalysis(g, spec).dispatchFile.content;
    // All 3 kinds have explicit equations
    expect(content).toContain("case 'Alpha':");
    expect(content).toContain("case 'Beta':");
    expect(content).toContain("case 'Gamma':");
    // Exhaustive never check is present
    expect(content).toContain('const _exhaustive: never = _kind;');
    // Each case calls its equation — no bare fall-through cases to a default value
    expect(content).toContain('eq_nodef_Alpha');
    expect(content).toContain('eq_nodef_Beta');
    expect(content).toContain('eq_nodef_Gamma');
  });

  it('rejects syn attr without default when equations are incomplete', () => {
    const eqA = withDeps([], function eq_miss_Alpha() { return 'a'; });
    const spec: AnalysisDecl = {
      attrs: [
        { name: 'test', direction: 'syn', type: 'string', equations: { Alpha: eqA } },
      ],
    };
    expect(() => compileAnalysis(g, spec)).toThrow(/missing equations for 2 kinds/);
  });

  it('rejects syn attr without default and without equations', () => {
    const spec: AnalysisDecl = {
      attrs: [
        { name: 'test', direction: 'syn', type: 'string' },
      ],
    };
    expect(() => compileAnalysis(g, spec)).toThrow(/no default and no equations/);
  });

  it('rejects syn attr without default when allKinds is empty', () => {
    const eqA = withDeps([], function eq_nokinds_Alpha() { return 'a'; });
    const spec: AnalysisDecl = {
      attrs: [
        { name: 'test', direction: 'syn', type: 'string', equations: { Alpha: eqA } },
      ],
    };
    // Empty allKinds — cannot verify exhaustiveness
    const noKindsGrammar = grammarWithKinds(new Set());
    expect(() => compileAnalysis(noKindsGrammar, spec)).toThrow(/requires allKinds/);
  });

  it('works with parameterized exhaustive syn attr', () => {
    const eqA = withDeps([], function eq_param_exh_Alpha() { return null; });
    const eqB = withDeps([], function eq_param_exh_Beta() { return null; });
    const eqG = withDeps([], function eq_param_exh_Gamma() { return null; });
    const spec: AnalysisDecl = {
      attrs: [
        {
          name: 'checkFor', direction: 'syn', type: 'string | null',
          parameter: { name: 'prop', type: 'string' },
          equations: { Alpha: eqA, Beta: eqB, Gamma: eqG },
        },
      ],
    };
    const result = compileAnalysis(g, spec);
    expect(result.attrs).toHaveLength(1);
    const content = result.dispatchFile.content;
    expect(content).toContain('const _exhaustive: never = _kind;');
  });
});
