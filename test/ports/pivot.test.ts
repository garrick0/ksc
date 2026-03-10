/**
 * Tests for pivotToAttrCentric and codegen-time spec validation.
 */
import { describe, it, expect } from 'vitest';
import { pivotToAttrCentric, compileAnalysis, code, withDeps } from '../../analysis/index.js';
import type { AnalysisSpec, AttrDecl } from '../../analysis/index.js';
import type { Grammar } from '../../grammar/index.js';

const gAB: Grammar = {
  fieldDefs: {},
  allKinds: new Set(['Alpha', 'Beta']),
  rootKind: 'Alpha',
  fileNameField: 'fileName',
  sumTypeMembers: {},
  sumTypeMembership: {},
};
const gNoKinds: Grammar = { ...gAB, allKinds: new Set() };

describe('pivotToAttrCentric', () => {
  it('pivots production-centric overrides to attr-centric', () => {
    const fn1 = function eq_kindDefs_CU() { return []; };
    const fn2 = function eq_violationFor_Id() { return null; };
    const fn3 = function eq_violationFor_Call() { return null; };

    const overrides = {
      CompilationUnit: { kindDefs: fn1 },
      Identifier: { violationFor: fn2 },
      CallExpression: { violationFor: fn3 },
    };

    const result = pivotToAttrCentric(overrides);

    expect(result.kindDefs).toEqual({ CompilationUnit: fn1 });
    expect(result.violationFor).toEqual({ Identifier: fn2, CallExpression: fn3 });
  });

  it('preserves withDeps metadata through pivot', () => {
    const fn = withDeps(['defEnv'], function eq_test() { return []; });
    const overrides = {
      CompilationUnit: { kindDefs: fn },
    };

    const result = pivotToAttrCentric(overrides);
    const pivotedFn = result.kindDefs!.CompilationUnit as any;

    expect(pivotedFn).toBe(fn); // Same reference
    expect(pivotedFn.deps).toEqual(['defEnv']);
    expect(pivotedFn.name).toBe('eq_test');
  });

  it('handles empty overrides', () => {
    const result = pivotToAttrCentric({});
    expect(result).toEqual({});
  });

  it('handles single kind with multiple attrs', () => {
    const fn1 = function eq_a() { return []; };
    const fn2 = function eq_b() { return null; };

    const overrides = {
      Identifier: { kindDefs: fn1, violationFor: fn2 },
    };

    const result = pivotToAttrCentric(overrides);
    expect(result.kindDefs).toEqual({ Identifier: fn1 });
    expect(result.violationFor).toEqual({ Identifier: fn2 });
  });
});

describe('codegen-time validation', () => {
  it('passes for valid spec with allKinds', () => {
    const eq = withDeps([], function eq_test() { return 'x'; });
    const spec: AnalysisSpec = {
      attrs: [
        { name: 'test', direction: 'syn', type: 'string', default: code("'x'"), equations: { Alpha: eq } },
      ],
      projections: {},
    };

    // Should not throw
    expect(() => compileAnalysis(gAB, spec)).not.toThrow();
  });

  it('throws for unknown kind in equation', () => {
    const eq = withDeps([], function eq_test() { return 'x'; });
    const spec: AnalysisSpec = {
      attrs: [
        { name: 'test', direction: 'syn', type: 'string', default: code("'x'"), equations: { Bogus: eq } },
      ],
      projections: {},
    };

    expect(() => compileAnalysis(gAB, spec)).toThrow("equation references unknown kind 'Bogus'");
  });

  it('throws for unknown rootKind', () => {
    const badRootGrammar: Grammar = { ...gAB, rootKind: 'NonexistentRoot' };
    const spec: AnalysisSpec = {
      attrs: [
        { name: 'test', direction: 'syn', type: 'string', default: code("'x'") },
      ],
      projections: {},
    };

    expect(() => compileAnalysis(badRootGrammar, spec)).toThrow("rootKind 'NonexistentRoot' is not a valid kind");
  });

  it('throws for anonymous equation function', () => {
    // Object.defineProperty to force an empty name (simulating truly anonymous fn)
    const anonFn = function() { return 'x'; };
    Object.defineProperty(anonFn, 'name', { value: '' });

    const gAlpha: Grammar = { ...gAB, allKinds: new Set(['Alpha']) };
    const spec: AnalysisSpec = {
      attrs: [
        { name: 'test', direction: 'syn', type: 'string', default: code("'x'"), equations: { Alpha: anonFn } },
      ],
      projections: {},
    };

    expect(() => compileAnalysis(gAlpha, spec)).toThrow('equation function has no name');
  });

  it('skips validation when allKinds is empty', () => {
    const spec: AnalysisSpec = {
      attrs: [
        { name: 'test', direction: 'syn', type: 'string', default: code("'x'"), equations: { Bogus: function eq() { return 'x'; } } },
      ],
      projections: {},
    };

    // Should not throw (kind validation only runs when allKinds is non-empty)
    expect(() => compileAnalysis(gNoKinds, spec)).not.toThrow();
  });
});
