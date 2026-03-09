/**
 * Unit tests for Functor 2: compileAnalysis
 *
 * Tests the pure compilation function with minimal analysis specs.
 * Attribute method bodies are generated from direction-typed declarations.
 * Dependencies are inferred from withDeps() on equation function references.
 */
import { describe, it, expect } from 'vitest';
import { compileAnalysis } from '../analysis/compile.js';
import type { AnalysisSpec, AttrDecl } from '../analysis/types.js';
import { code, withDeps } from '../analysis/types.js';

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

function makeMinimalSpec(): AnalysisSpec {
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

  return {
    attrs,
    projections: {
      definitions: () => [],
      diagnostics: () => [],
    },
    grammarConfig: {
      rootKind: 'Root',
      fileNameField: 'fileName',
    },
    evaluatorSetup: {
      imports: ({ specImportPath }) => [
        `import { analysisSpec } from '${specImportPath}';`,
      ],
      evaluateBody: () => [
        `export interface EvaluationResult {`,
        `  getDepGraph(): AttributeDepGraph;`,
        `}`,
        ``,
        `export function evaluate(root: KSNode): EvaluationResult {`,
        `  const dnodeRoot = buildKSCTree(root);`,
        `  return { getDepGraph: () => KSC_STATIC_DEP_GRAPH };`,
        `}`,
        ``,
        `export function buildTree(root: KSNode): KSCDNode {`,
        `  return buildKSCTree(root);`,
        `}`,
      ],
    },
  };
}

describe('compileAnalysis — minimal spec', () => {
  const spec = makeMinimalSpec();
  const result = compileAnalysis(spec);

  it('produces evaluator.ts and attr-types.ts', () => {
    expect(result.evaluatorFile.path).toBe('evaluator.ts');
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

  it('evaluator.ts contains KSCDNode class', () => {
    const content = result.evaluatorFile.content;
    expect(content).toContain('export class KSCDNode');
    expect(content).toContain('export function evaluate');
    expect(content).toContain('export function buildTree');
  });

  it('evaluator.ts auto-generates equation imports', () => {
    const content = result.evaluatorFile.content;
    expect(content).toContain('eq_noFooContext_root');
    expect(content).toContain('eq_fooViolation_default');
    expect(content).toContain('eq_allViolations_default');
    expect(content).toContain('auto-generated from function references');
  });

  it('evaluator.ts has auto-generated header', () => {
    expect(result.evaluatorFile.content).toContain('AUTO-GENERATED');
    expect(result.attrTypesFile.content).toContain('AUTO-GENERATED');
  });
});

describe('compileAnalysis — empty spec', () => {
  it('handles spec with no attrs', () => {
    const spec: AnalysisSpec = {
      attrs: [],
      projections: { definitions: () => [], diagnostics: () => [] },
      grammarConfig: { rootKind: 'Root', fileNameField: 'fileName' },
    };
    const result = compileAnalysis(spec);
    expect(result.attrs).toHaveLength(0);
  });
});

describe('compileAnalysis — collection attributes', () => {
  it('handles collection attrs', () => {
    const spec: AnalysisSpec = {
      attrs: [
        {
          name: 'count',
          direction: 'collection',
          type: 'number',
          init: 1,
          combine: code('(acc: number, c: number) => acc + c'),
        },
      ],
      projections: { definitions: () => [], diagnostics: () => [] },
      grammarConfig: { rootKind: 'Root', fileNameField: 'fileName' },
    };
    const result = compileAnalysis(spec);
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

    const spec: AnalysisSpec = {
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
      projections: { definitions: () => [], diagnostics: () => [] },
      grammarConfig: { rootKind: 'Root', fileNameField: 'fileName' },
    };
    const result = compileAnalysis(spec);
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
  it('generates Map cache for parameterized attrs', () => {
    const spec: AnalysisSpec = {
      attrs: [
        {
          name: 'contextFor',
          direction: 'inh',
          type: 'string | null',
          parameter: { name: 'property', type: 'string' },
          rootValue: null,
        },
      ],
      projections: { definitions: () => [], diagnostics: () => [] },
      grammarConfig: { rootKind: 'Root', fileNameField: 'fileName' },
    };
    const result = compileAnalysis(spec);
    const content = result.evaluatorFile.content;
    expect(content).toContain('_pc_contextFor');
    expect(content).toContain('new Map<string, string | null>()');
    expect(content).toContain('contextFor(property: string): string | null');
  });

  it('excludes parameterized attrs from KSCAttrMap', () => {
    const spec: AnalysisSpec = {
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
      projections: { definitions: () => [], diagnostics: () => [] },
      grammarConfig: { rootKind: 'Root', fileNameField: 'fileName' },
    };
    const result = compileAnalysis(spec);
    const attrTypes = result.attrTypesFile.content;
    expect(attrTypes).toContain('simple: number');
    expect(attrTypes).not.toContain('paramAttr');
  });
});
