import { describe, it, expect, vi } from 'vitest';
import { compile } from '../src/compile.js';
import { applyAttributes } from '../src/apply.js';
import { stampTree } from '../src/stamp.js';

// Simple AST node types for testing
interface Leaf { type: 'Leaf'; value: number; kids: never[] }
interface Pair { type: 'Pair'; left: Leaf; right: Leaf; kids: [Leaf, Leaf] }

function leaf(value: number): Leaf { return { type: 'Leaf', value, kids: [] }; }
function pair(left: Leaf, right: Leaf): Pair {
  return { type: 'Pair', left, right, kids: [left, right] };
}

describe('syn (via compile)', () => {
  it('returns an AttributeDef with install method', () => {
    const def = compile<Leaf>('doubled', { direction: 'syn' }, (n: Leaf) => n.value * 2);
    expect(typeof def.install).toBe('function');
  });

  it('installs a lazy getter that computes and caches', () => {
    const computeFn = vi.fn((n: Leaf) => n.value * 2);
    const def = compile<Leaf>('doubled', { direction: 'syn' }, computeFn);

    const n = leaf(5);
    def.install(n, 'doubled');
    expect((n as any).doubled).toBe(10);
    expect((n as any).doubled).toBe(10);
    expect(computeFn).toHaveBeenCalledTimes(1);
  });

  it('value is visible as a property on the node', () => {
    const def = compile<Leaf>('doubled', { direction: 'syn' }, (n: Leaf) => n.value * 2);
    const n = leaf(5);
    def.install(n, 'doubled');

    void (n as any).doubled;
    expect(Object.keys(n)).toContain('doubled');
    expect((n as any).doubled).toBe(10);
  });

  it('caches independently per node', () => {
    const computeFn = vi.fn((n: Leaf) => n.value * 2);
    const def = compile<Leaf>('doubled', { direction: 'syn' }, computeFn);

    const a = leaf(3);
    const b = leaf(7);
    def.install(a, 'doubled');
    def.install(b, 'doubled');

    expect((a as any).doubled).toBe(6);
    expect((b as any).doubled).toBe(14);
    expect(computeFn).toHaveBeenCalledTimes(2);
  });

  it('caches undefined and false correctly', () => {
    const computeUndef = vi.fn((_n: Leaf) => undefined);
    const defU = compile<Leaf>('u', { direction: 'syn' }, computeUndef);
    const n = leaf(1);
    defU.install(n, 'u');
    expect((n as any).u).toBeUndefined();
    expect((n as any).u).toBeUndefined();
    expect(computeUndef).toHaveBeenCalledTimes(1);

    const computeFalse = vi.fn((_n: Leaf) => false);
    const defF = compile<Leaf>('f', { direction: 'syn' }, computeFalse);
    const m = leaf(2);
    defF.install(m, 'f');
    expect((m as any).f).toBe(false);
    expect((m as any).f).toBe(false);
    expect(computeFalse).toHaveBeenCalledTimes(1);
  });

  it('works with applyAttributes across a tree', () => {
    const l1 = leaf(3);
    const l2 = leaf(7);
    const p = pair(l1, l2);
    stampTree(p, (n) => (n as any).kids ?? []);

    applyAttributes(p, {
      doubled: compile<Leaf | Pair>('doubled', { direction: 'syn' },
        (n: Leaf | Pair) => n.type === 'Leaf' ? n.value * 2 : 0),
    });

    expect((l1 as any).doubled).toBe(6);
    expect((l2 as any).doubled).toBe(14);
    expect((p as any).doubled).toBe(0);
  });
});

describe('uncached (via compile)', () => {
  it('recomputes every access', () => {
    let counter = 0;
    const def = compile<Leaf>('c', { direction: 'syn', uncached: true }, (_n: Leaf) => ++counter);

    const n = leaf(1);
    def.install(n, 'c');
    expect((n as any).c).toBe(1);
    expect((n as any).c).toBe(2);
    expect((n as any).c).toBe(3);
  });
});

describe('collection (via compile)', () => {
  it('aggregates contributions bottom-up', () => {
    interface TNode { kind: string; value: number; kids: TNode[] }
    const root: TNode = {
      kind: 'Root', value: 1, kids: [
        { kind: 'Leaf', value: 10, kids: [] },
        { kind: 'Branch', value: 2, kids: [
          { kind: 'Leaf', value: 20, kids: [] },
        ]},
      ],
    };
    stampTree(root, (n: TNode) => n.kids);

    const def = compile<TNode>('total', {
      direction: 'collection',
      initial: 0,
      combine: (a: number, b: number) => a + b,
    }, (n: TNode) => n.value);

    applyAttributes(root, { total: def });

    // Leaves: own value
    expect((root.kids[0] as any).total).toBe(10);
    expect((root.kids[1].kids[0] as any).total).toBe(20);
    // Branch: 2 + 20 = 22
    expect((root.kids[1] as any).total).toBe(22);
    // Root: 1 + 10 + 22 = 33
    expect((root as any).total).toBe(33);
  });

  it('works with array contributions', () => {
    interface TNode { kind: string; tag?: string; kids: TNode[] }
    const root: TNode = {
      kind: 'Root', kids: [
        { kind: 'Leaf', tag: 'a', kids: [] },
        { kind: 'Branch', kids: [
          { kind: 'Leaf', tag: 'b', kids: [] },
          { kind: 'Leaf', kids: [] },
        ]},
      ],
    };
    stampTree(root, (n: TNode) => n.kids);

    const def = compile<TNode>('tags', {
      direction: 'collection',
      initial: [] as string[],
      combine: (acc: string[], c: string[]) =>
        acc.length === 0 ? c : c.length === 0 ? acc : [...acc, ...c],
    }, (n: TNode) => n.tag ? [n.tag] : []);

    applyAttributes(root, { tags: def });

    expect((root.kids[0] as any).tags).toEqual(['a']);
    expect((root.kids[1] as any).tags).toEqual(['b']);
    expect((root as any).tags).toEqual(['a', 'b']);
  });

  it('works with production equation dispatch', () => {
    interface TNode { kind: string; value?: number; kids: TNode[] }
    const root: TNode = {
      kind: 'Root', kids: [
        { kind: 'Leaf', value: 5, kids: [] },
        { kind: 'Leaf', value: 3, kids: [] },
      ],
    };
    stampTree(root, (n: TNode) => n.kids);

    const def = compile<TNode>('sum', {
      direction: 'collection',
      initial: 0,
      combine: (a: number, b: number) => a + b,
    }, {
      Leaf: (n: TNode) => n.value ?? 0,
      _: () => 0,
    });

    applyAttributes(root, { sum: def });
    expect((root as any).sum).toBe(8);
  });
});

describe('paramSyn (via compile)', () => {
  it('installs a function that caches by param', () => {
    const computeFn = vi.fn((n: Leaf, k: number) => n.value * k);
    const def = compile<Leaf>('scaled', { direction: 'paramSyn' }, computeFn);

    const n = leaf(5);
    def.install(n, 'scaled');
    const scaled = (n as any).scaled as (k: number) => number;

    expect(scaled(2)).toBe(10);
    expect(scaled(3)).toBe(15);
    expect(scaled(2)).toBe(10); // cached
    expect(computeFn).toHaveBeenCalledTimes(2); // only 2 unique params
  });

  it('caches independently per node', () => {
    const computeFn = vi.fn((n: Leaf, k: number) => n.value * k);
    const def = compile<Leaf>('scaled', { direction: 'paramSyn' }, computeFn);

    const a = leaf(3);
    const b = leaf(7);
    def.install(a, 'scaled');
    def.install(b, 'scaled');

    expect((a as any).scaled(2)).toBe(6);
    expect((b as any).scaled(2)).toBe(14);
    expect(computeFn).toHaveBeenCalledTimes(2);
  });
});
