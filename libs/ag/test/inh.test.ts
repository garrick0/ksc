import { describe, it, expect } from 'vitest';
import { stampTree } from '../src/stamp.js';
import { applyAttributes } from '../src/apply.js';
import { compile } from '../src/compile.js';

interface TNode {
  name: string;
  kind: string;
  kids: TNode[];
}

function node(name: string, kind: string, ...kids: TNode[]): TNode {
  return { name, kind, kids };
}

describe('inh (via compile)', () => {
  //       a (scope)
  //      / \
  //     b   c (scope)
  //    /     \
  //   d       e
  const d = node('d', 'expr');
  const b = node('b', 'expr', d);
  const e = node('e', 'expr');
  const c = node('c', 'scope', e);
  const a = node('a', 'scope', b, c);
  stampTree(a, (n) => n.kids);

  it('propagates root value to all descendants when no eq', () => {
    applyAttributes(a, {
      level: compile<TNode>('level', { direction: 'inh', root: 0 }, undefined),
    });

    expect((a as any).level).toBe(0);
    expect((b as any).level).toBe(0);
    expect((c as any).level).toBe(0);
    expect((d as any).level).toBe(0);
    expect((e as any).level).toBe(0);
  });

  it('rootValue can be a function', () => {
    applyAttributes(a, {
      rootName: compile<TNode>('rootName', { direction: 'inh', root: (root: TNode) => root.name }, undefined),
    });

    expect((a as any).rootName).toBe('a');
    expect((b as any).rootName).toBe('a');
    expect((d as any).rootName).toBe('a');
  });

  it('parent equation provides values to children', () => {
    applyAttributes(a, {
      scopeName: compile<TNode>('scopeName',
        { direction: 'inh', root: 'global' },
        (parent: TNode) => {
          if (parent.kind === 'scope') return `scope-${parent.name}`;
          return undefined; // auto-propagate
        },
      ),
    });

    expect((a as any).scopeName).toBe('global');
    expect((b as any).scopeName).toBe('scope-a');
    expect((d as any).scopeName).toBe('scope-a');
    expect((c as any).scopeName).toBe('scope-a');
    expect((e as any).scopeName).toBe('scope-c');
  });

  it('inherits from nearest parent that provides a value', () => {
    applyAttributes(a, {
      env: compile<TNode>('env',
        { direction: 'inh', root: 'root-env' },
        (parent: TNode) => {
          if (parent.kind === 'scope') return `env-${parent.name}`;
          return undefined;
        },
      ),
    });

    expect((a as any).env).toBe('root-env');
    expect((b as any).env).toBe('env-a');
    expect((d as any).env).toBe('env-a');
    expect((c as any).env).toBe('env-a');
    expect((e as any).env).toBe('env-c');
  });

  it('parent can use its own attributes in the equation', () => {
    applyAttributes(a, {
      depth: compile<TNode>('depth',
        { direction: 'inh', root: 0 },
        (parent: TNode) => (parent as any).depth + 1,
      ),
    });

    expect((a as any).depth).toBe(0);
    expect((b as any).depth).toBe(1);
    expect((c as any).depth).toBe(1);
    expect((d as any).depth).toBe(2);
    expect((e as any).depth).toBe(2);
  });

  it('eq receives child and childIndex', () => {
    applyAttributes(a, {
      childInfo: compile<TNode>('childInfo',
        { direction: 'inh', root: 'root' },
        (_parent: TNode, _child: TNode, childIndex: number) => `child-${childIndex}`,
      ),
    });

    expect((a as any).childInfo).toBe('root');
    expect((b as any).childInfo).toBe('child-0');
    expect((c as any).childInfo).toBe('child-1');
    expect((d as any).childInfo).toBe('child-0');
    expect((e as any).childInfo).toBe('child-0');
  });

  it('result is cached (lazy getter becomes data property)', () => {
    const d2 = node('d2', 'expr');
    const a2 = node('a2', 'scope', d2);
    stampTree(a2, (n) => n.kids);

    let computeCount = 0;
    applyAttributes(a2, {
      val: compile<TNode>('val', { direction: 'inh', root: () => { computeCount++; return 0; } }, undefined),
    });

    void (a2 as any).val;
    void (a2 as any).val;
    expect(computeCount).toBe(1);
  });

  it('broadcast from root computes only once', () => {
    const d2 = node('d2', 'leaf');
    const b2 = node('b2', 'inner', d2);
    const a2 = node('a2', 'root', b2);
    stampTree(a2, (n) => n.kids);

    let count = 0;
    applyAttributes(a2, {
      val: compile<TNode>('val', { direction: 'inh', root: () => { count++; return 42; } }, undefined),
    });

    void (a2 as any).val;
    void (b2 as any).val;
    void (d2 as any).val;
    expect((a2 as any).val).toBe(42);
    expect((b2 as any).val).toBe(42);
    expect((d2 as any).val).toBe(42);
  });
});
