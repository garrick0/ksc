import { describe, it, expect, vi } from 'vitest';
import { installLazy, stampTree } from '../src/stamp.js';

// Simple tree node type
interface TNode {
  name: string;
  kids: TNode[];
}

function node(name: string, ...kids: TNode[]): TNode {
  return { name, kids };
}

function getChildren(n: TNode): TNode[] {
  return n.kids;
}

describe('installLazy', () => {
  it('computes on first access and caches', () => {
    const computeFn = vi.fn(() => 42);
    const obj: Record<string, unknown> = {};
    installLazy(obj, 'x', computeFn);

    expect((obj as any).x).toBe(42);
    expect((obj as any).x).toBe(42);
    expect(computeFn).toHaveBeenCalledTimes(1);
  });

  it('replaces getter with data property', () => {
    const obj: Record<string, unknown> = {};
    installLazy(obj, 'x', () => 'hello');

    // Before access, it's a getter
    const desc1 = Object.getOwnPropertyDescriptor(obj, 'x')!;
    expect(desc1.get).toBeDefined();

    // After access, it's a data property
    void (obj as any).x;
    const desc2 = Object.getOwnPropertyDescriptor(obj, 'x')!;
    expect(desc2.value).toBe('hello');
    expect(desc2.get).toBeUndefined();
  });

  it('caches undefined correctly', () => {
    const computeFn = vi.fn(() => undefined);
    const obj: Record<string, unknown> = {};
    installLazy(obj, 'x', computeFn);

    expect((obj as any).x).toBeUndefined();
    expect((obj as any).x).toBeUndefined();
    expect(computeFn).toHaveBeenCalledTimes(1);
  });

  it('caches false correctly', () => {
    const computeFn = vi.fn(() => false);
    const obj: Record<string, unknown> = {};
    installLazy(obj, 'x', computeFn);

    expect((obj as any).x).toBe(false);
    expect((obj as any).x).toBe(false);
    expect(computeFn).toHaveBeenCalledTimes(1);
  });

  it('value is enumerable', () => {
    const obj: Record<string, unknown> = { a: 1 };
    installLazy(obj, 'x', () => 42);

    void (obj as any).x;
    expect(Object.keys(obj)).toContain('x');
  });
});

describe('stampTree', () => {
  //       a
  //      / \
  //     b   c
  //    / \
  //   d   e
  const d = node('d');
  const e = node('e');
  const b = node('b', d, e);
  const c = node('c');
  const a = node('a', b, c);

  // Stamp before tests
  stampTree(a, getChildren);

  it('stamps $root correctly', () => {
    expect((a as any).$root).toBe(true);
    expect((b as any).$root).toBe(false);
    expect((d as any).$root).toBe(false);
  });

  it('stamps $parent correctly', () => {
    expect((a as any).$parent).toBeUndefined();
    expect((b as any).$parent).toBe(a);
    expect((c as any).$parent).toBe(a);
    expect((d as any).$parent).toBe(b);
    expect((e as any).$parent).toBe(b);
  });

  it('stamps $children correctly', () => {
    expect((a as any).$children).toEqual([b, c]);
    expect((b as any).$children).toEqual([d, e]);
    expect((c as any).$children).toEqual([]);
    expect((d as any).$children).toEqual([]);
  });

  it('stamps $index correctly', () => {
    expect((a as any).$index).toBe(-1); // root
    expect((b as any).$index).toBe(0);
    expect((c as any).$index).toBe(1);
    expect((d as any).$index).toBe(0);
    expect((e as any).$index).toBe(1);
  });

  it('stamps $prev correctly', () => {
    expect((a as any).$prev).toBeUndefined();
    expect((b as any).$prev).toBeUndefined(); // first child
    expect((c as any).$prev).toBe(b);
    expect((d as any).$prev).toBeUndefined();
    expect((e as any).$prev).toBe(d);
  });

  it('stamps $next correctly', () => {
    expect((a as any).$next).toBeUndefined();
    expect((b as any).$next).toBe(c);
    expect((c as any).$next).toBeUndefined(); // last child
    expect((d as any).$next).toBe(e);
    expect((e as any).$next).toBeUndefined();
  });

  it('works with a single-node tree', () => {
    const single = node('solo');
    stampTree(single, getChildren);

    expect((single as any).$root).toBe(true);
    expect((single as any).$parent).toBeUndefined();
    expect((single as any).$children).toEqual([]);
    expect((single as any).$index).toBe(-1);
    expect((single as any).$prev).toBeUndefined();
    expect((single as any).$next).toBeUndefined();
  });
});
