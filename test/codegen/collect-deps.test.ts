/**
 * Tests for collectDepsForAttr and withDeps.
 */
import { describe, it, expect } from 'vitest';
import { collectDepsForAttr, withDeps, code } from '@ksc/behavior/index.js';
import type { AttrDecl } from '@ksc/behavior/index.js';

describe('collectDepsForAttr', () => {
  it('returns [] for syn attr with no deps', () => {
    const attr: AttrDecl = { name: 'simple', direction: 'syn', type: 'number', default: 0 };
    expect(collectDepsForAttr(attr)).toEqual([]);
  });

  it('returns deps from syn attr equations, deduplicating', () => {
    const eqA = withDeps(['depA'], function eqA() { return null; });
    const eqB = withDeps(['depB'], function eqB() { return null; });
    const eqC = withDeps(['depA', 'depC'], function eqC() { return null; });
    const attr: AttrDecl = {
      name: 'multi', direction: 'syn', type: 'number', default: 0,
      equations: { A: eqA, B: eqB, C: eqC },
    };
    const deps = collectDepsForAttr(attr);
    expect(deps).toContain('depA');
    expect(deps).toContain('depB');
    expect(deps).toContain('depC');
    expect(deps.filter(d => d === 'depA').length).toBe(1);
  });

  it('returns deps from inh attr rootValue and parentEquations', () => {
    const rootFn = withDeps(['kindDefs'], function eqRoot() { return null; });
    const parentFn = withDeps(['defEnv'], function eqParent() { return 'override'; });
    const attr: AttrDecl = {
      name: 'ctx', direction: 'inh', type: 'string | null',
      rootValue: rootFn, parentEquations: { Alpha: parentFn },
    };
    const deps = collectDepsForAttr(attr);
    expect(deps).toContain('kindDefs');
    expect(deps).toContain('defEnv');
  });

  it('returns [] for collection attr and bare functions without withDeps', () => {
    const collAttr: AttrDecl = {
      name: 'count', direction: 'collection', type: 'number',
      init: 1, combine: code('(acc: number, c: number) => acc + c'),
    };
    expect(collectDepsForAttr(collAttr)).toEqual([]);

    const bareFn = function bareEquation() { return 42; };
    const bareAttr: AttrDecl = { name: 'bare', direction: 'syn', type: 'number', default: bareFn };
    expect(collectDepsForAttr(bareAttr)).toEqual([]);
  });
});

describe('withDeps', () => {
  it('attaches deps array, preserves name and behavior', () => {
    const fn = withDeps(['a', 'b'], function add(a: number, b: number) { return a + b; });
    expect(fn.deps).toEqual(['a', 'b']);
    expect(fn.name).toBe('add');
    expect(fn(2, 3)).toBe(5);
  });
});
