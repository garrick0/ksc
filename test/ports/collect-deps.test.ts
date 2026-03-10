/**
 * P3-19: Tests for collectDepsForAttr and withDeps.
 *
 * Verifies that the equation dependency framework correctly:
 *   - attaches deps to functions via withDeps()
 *   - collects deps from syn, inh, and collection attrs
 *   - handles code literals, bare functions, and mixed equations
 */
import { describe, it, expect } from 'vitest';
import { collectDepsForAttr, withDeps, code } from '../../analysis/index.js';
import type { AttrDecl } from '../../analysis/index.js';

describe('collectDepsForAttr', () => {
  it('returns [] for syn attr with no deps', () => {
    const attr: AttrDecl = {
      name: 'simple',
      direction: 'syn',
      type: 'number',
      default: 0,
    };
    expect(collectDepsForAttr(attr)).toEqual([]);
  });

  it('returns [] for syn attr with code literal default', () => {
    const attr: AttrDecl = {
      name: 'literal',
      direction: 'syn',
      type: 'string',
      default: code("'hello'"),
    };
    expect(collectDepsForAttr(attr)).toEqual([]);
  });

  it('returns deps from syn attr default with withDeps', () => {
    const fn = withDeps(['defEnv'], function eqDefault() { return null; });
    const attr: AttrDecl = {
      name: 'lookup',
      direction: 'syn',
      type: 'string | null',
      default: fn,
    };
    expect(collectDepsForAttr(attr)).toEqual(['defEnv']);
  });

  it('returns deps from syn attr equations with withDeps', () => {
    const eqAlpha = withDeps(['defEnv', 'kindDefs'], function eqAlpha() { return null; });
    const attr: AttrDecl = {
      name: 'test',
      direction: 'syn',
      type: 'string | null',
      default: null,
      equations: { Alpha: eqAlpha },
    };
    const deps = collectDepsForAttr(attr);
    expect(deps).toContain('defEnv');
    expect(deps).toContain('kindDefs');
  });

  it('accumulates deps from multiple equations', () => {
    const eqA = withDeps(['depA'], function eqA() { return null; });
    const eqB = withDeps(['depB'], function eqB() { return null; });
    const eqC = withDeps(['depA', 'depC'], function eqC() { return null; });
    const attr: AttrDecl = {
      name: 'multi',
      direction: 'syn',
      type: 'number',
      default: 0,
      equations: { A: eqA, B: eqB, C: eqC },
    };
    const deps = collectDepsForAttr(attr);
    expect(deps).toContain('depA');
    expect(deps).toContain('depB');
    expect(deps).toContain('depC');
    // depA appears in eqA and eqC but should be deduplicated
    expect(deps.filter(d => d === 'depA').length).toBe(1);
  });

  it('returns deps from inh attr rootValue with withDeps', () => {
    const rootFn = withDeps(['kindDefs'], function eqRoot() { return null; });
    const attr: AttrDecl = {
      name: 'ctx',
      direction: 'inh',
      type: 'string | null',
      rootValue: rootFn,
    };
    expect(collectDepsForAttr(attr)).toEqual(['kindDefs']);
  });

  it('returns deps from inh attr parentEquations', () => {
    const parentFn = withDeps(['defEnv'], function eqParent() { return 'override'; });
    const attr: AttrDecl = {
      name: 'ctx',
      direction: 'inh',
      type: 'string | null',
      rootValue: null,
      parentEquations: { Alpha: parentFn },
    };
    expect(collectDepsForAttr(attr)).toEqual(['defEnv']);
  });

  it('returns [] for collection attr (no withDeps on init)', () => {
    const attr: AttrDecl = {
      name: 'count',
      direction: 'collection',
      type: 'number',
      init: 1,
      combine: code('(acc: number, c: number) => acc + c'),
    };
    expect(collectDepsForAttr(attr)).toEqual([]);
  });

  it('returns [] for functions without withDeps', () => {
    const bareFn = function bareEquation() { return 42; };
    const attr: AttrDecl = {
      name: 'bare',
      direction: 'syn',
      type: 'number',
      default: bareFn,
    };
    expect(collectDepsForAttr(attr)).toEqual([]);
  });
});

describe('withDeps', () => {
  it('attaches deps array to a function', () => {
    const fn = withDeps(['a', 'b'], function myFn() { return 1; });
    expect(fn.deps).toEqual(['a', 'b']);
  });

  it('preserves function name', () => {
    const fn = withDeps(['x'], function namedFn() { return 1; });
    expect(fn.name).toBe('namedFn');
  });

  it('preserves function behavior', () => {
    const fn = withDeps(['x'], function add(a: number, b: number) { return a + b; });
    expect(fn(2, 3)).toBe(5);
  });

  it('overwrites previous deps on re-call', () => {
    const fn = function myFn() { return 1; };
    withDeps(['a'], fn);
    expect((fn as any).deps).toEqual(['a']);
    withDeps(['b', 'c'], fn);
    expect((fn as any).deps).toEqual(['b', 'c']);
  });
});
