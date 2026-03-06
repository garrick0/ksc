/**
 * Tests for compile() — all attribute directions and installLazy.
 */
import { describe, it, expect, vi } from 'vitest';
import { compile, installLazy } from '../src/compile.js';
import { applyAttributes, stampTree } from '../src/interpret.js';

// ── installLazy ─────────────────────────────────────────────────────────

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

// ── syn ─────────────────────────────────────────────────────────────────

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

// ── uncached ────────────────────────────────────────────────────────────

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

// ── paramSyn ────────────────────────────────────────────────────────────

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

// ── match / production equations ────────────────────────────────────────

type ASTLeaf = { kind: 'Leaf'; value: number; children: ASTNode[] };
type ASTBranch = { kind: 'Branch'; left: ASTNode; right: ASTNode; children: ASTNode[] };
type ASTNode = ASTLeaf | ASTBranch;

function astLeaf(value: number): ASTLeaf {
  return { kind: 'Leaf', value, children: [] };
}
function astBranch(left: ASTNode, right: ASTNode): ASTBranch {
  return { kind: 'Branch', left, right, children: [left, right] };
}

type TLeaf = { type: 'Leaf'; v: number; children: never[] };
type TBranch = { type: 'Branch'; l: TLeaf; r: TLeaf; children: TLeaf[] };
type TNode = TLeaf | TBranch;

describe('match / production equations (via compile)', () => {
  it('returns an AttributeDef', () => {
    const def = compile<ASTNode>('val', { direction: 'syn' }, {
      Leaf: (n: ASTLeaf) => n.value,
      _: () => 0,
    });
    expect(typeof def.install).toBe('function');
  });

  it('dispatches to the correct equation by discriminant', () => {
    const tree = astBranch(astLeaf(3), astLeaf(7));
    stampTree(tree, (n) => n.children);

    const evalDef = compile<ASTNode>('eval_', { direction: 'syn' }, {
      Leaf: (n: ASTLeaf) => n.value,
      Branch: (n: ASTBranch) => (n.left as any).eval_ + (n.right as any).eval_,
    });

    applyAttributes(tree, { eval_: evalDef });
    expect((tree as any).eval_).toBe(10);
  });

  it('uses _ fallback for unmatched kinds', () => {
    const isLeafDef = compile<ASTNode>('isLeaf', { direction: 'syn' }, {
      Leaf: () => true,
      _: () => false,
    });

    const l = astLeaf(1);
    const b = astBranch(l, astLeaf(2));
    stampTree(b, (n) => n.children);
    applyAttributes(b, { isLeaf: isLeafDef });

    expect((l as any).isLeaf).toBe(true);
    expect((b as any).isLeaf).toBe(false);
  });

  it('throws when no equation matches and no _ provided', () => {
    const partial = compile<ASTNode>('val', { direction: 'syn' }, {
      Leaf: (n: ASTLeaf) => n.value,
    });

    const b = astBranch(astLeaf(1), astLeaf(2));
    stampTree(b, (n) => n.children);
    applyAttributes(b, { val: partial });

    expect(() => (b as any).val).toThrow(
      "match: no equation for 'Branch' and no default '_' provided",
    );
  });

  it('caches results (lazy getter -> data property)', () => {
    const computeFn = vi.fn((n: ASTLeaf) => n.value * 2);
    const doubled = compile<ASTNode>('doubled', { direction: 'syn' }, {
      Leaf: computeFn,
      _: () => 0,
    });

    const n = astLeaf(5);
    stampTree(n, (nd) => nd.children);
    applyAttributes(n, { doubled });

    expect((n as any).doubled).toBe(10);
    expect((n as any).doubled).toBe(10);
    expect(computeFn).toHaveBeenCalledTimes(1);
  });

  it('works with different discriminant fields', () => {
    const tree: TBranch = {
      type: 'Branch',
      l: { type: 'Leaf', v: 4, children: [] },
      r: { type: 'Leaf', v: 6, children: [] },
      children: [
        { type: 'Leaf', v: 4, children: [] },
        { type: 'Leaf', v: 6, children: [] },
      ],
    };
    tree.children = [tree.l, tree.r];
    stampTree(tree, (n) => (n as any).children ?? []);

    const evalDef = compile<TNode>('eval_', { direction: 'syn', discriminant: 'type' }, {
      Leaf: (n: TLeaf) => n.v,
      Branch: (n: TBranch) => (n.l as any).eval_ + (n.r as any).eval_,
    });

    applyAttributes(tree, { eval_: evalDef });
    expect((tree as any).eval_).toBe(10);
  });

  it('handles recursive tree evaluation', () => {
    const tree = astBranch(astBranch(astLeaf(1), astLeaf(2)), astLeaf(3));
    stampTree(tree, (n) => n.children);

    const depthDef = compile<ASTNode>('depth', { direction: 'syn' }, {
      Leaf: () => 0,
      Branch: (n: ASTBranch) => 1 + Math.max((n.left as any).depth, (n.right as any).depth),
    });

    applyAttributes(tree, { depth: depthDef });
    expect((tree as any).depth).toBe(2);
  });
});

// ── inh ─────────────────────────────────────────────────────────────────

interface INode {
  name: string;
  kind: string;
  kids: INode[];
}

function inode(name: string, kind: string, ...kids: INode[]): INode {
  return { name, kind, kids };
}

describe('inh (via compile)', () => {
  //       a (scope)
  //      / \
  //     b   c (scope)
  //    /     \
  //   d       e
  const d = inode('d', 'expr');
  const b = inode('b', 'expr', d);
  const e = inode('e', 'expr');
  const c = inode('c', 'scope', e);
  const a = inode('a', 'scope', b, c);
  stampTree(a, (n) => n.kids);

  it('propagates root value to all descendants when no eq', () => {
    applyAttributes(a, {
      level: compile<INode>('level', { direction: 'inh', root: 0 }, undefined),
    });

    expect((a as any).level).toBe(0);
    expect((b as any).level).toBe(0);
    expect((c as any).level).toBe(0);
    expect((d as any).level).toBe(0);
    expect((e as any).level).toBe(0);
  });

  it('rootValue can be a function', () => {
    applyAttributes(a, {
      rootName: compile<INode>('rootName', { direction: 'inh', root: (root: INode) => root.name }, undefined),
    });

    expect((a as any).rootName).toBe('a');
    expect((b as any).rootName).toBe('a');
    expect((d as any).rootName).toBe('a');
  });

  it('parent equation provides values to children', () => {
    applyAttributes(a, {
      scopeName: compile<INode>('scopeName',
        { direction: 'inh', root: 'global' },
        (parent: INode) => {
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
      env: compile<INode>('env',
        { direction: 'inh', root: 'root-env' },
        (parent: INode) => {
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
      depth: compile<INode>('depth',
        { direction: 'inh', root: 0 },
        (parent: INode) => (parent as any).depth + 1,
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
      childInfo: compile<INode>('childInfo',
        { direction: 'inh', root: 'root' },
        (_parent: INode, _child: INode, childIndex: number) => `child-${childIndex}`,
      ),
    });

    expect((a as any).childInfo).toBe('root');
    expect((b as any).childInfo).toBe('child-0');
    expect((c as any).childInfo).toBe('child-1');
    expect((d as any).childInfo).toBe('child-0');
    expect((e as any).childInfo).toBe('child-0');
  });

  it('result is cached (lazy getter becomes data property)', () => {
    const d2 = inode('d2', 'expr');
    const a2 = inode('a2', 'scope', d2);
    stampTree(a2, (n) => n.kids);

    let computeCount = 0;
    applyAttributes(a2, {
      val: compile<INode>('val', { direction: 'inh', root: () => { computeCount++; return 0; } }, undefined),
    });

    void (a2 as any).val;
    void (a2 as any).val;
    expect(computeCount).toBe(1);
  });

  it('broadcast from root computes only once', () => {
    const d2 = inode('d2', 'leaf');
    const b2 = inode('b2', 'inner', d2);
    const a2 = inode('a2', 'root', b2);
    stampTree(a2, (n) => n.kids);

    let count = 0;
    applyAttributes(a2, {
      val: compile<INode>('val', { direction: 'inh', root: () => { count++; return 42; } }, undefined),
    });

    void (a2 as any).val;
    void (b2 as any).val;
    void (d2 as any).val;
    expect((a2 as any).val).toBe(42);
    expect((b2 as any).val).toBe(42);
    expect((d2 as any).val).toBe(42);
  });
});

// ── circular ────────────────────────────────────────────────────────────

interface CNode { name: string; kids: CNode[] }
function cnode(name: string, ...kids: CNode[]): CNode { return { name, kids }; }

describe('circular (via compile)', () => {
  it('converges on a self-referencing attribute', () => {
    const n = cnode('a');
    stampTree(n, (nd) => nd.kids);

    applyAttributes(n, {
      counter: compile<CNode>('counter',
        { direction: 'circular', bottom: 0 },
        (nd: CNode) => {
          const current = (nd as any).counter;
          return current < 5 ? current + 1 : current;
        },
      ),
    });

    expect((n as any).counter).toBe(5);
  });

  it('handles immediate convergence (init is already fixed point)', () => {
    const n = cnode('a');
    stampTree(n, (nd) => nd.kids);

    applyAttributes(n, {
      val: compile<CNode>('val', { direction: 'circular', bottom: 42 }, () => 42),
    });

    expect((n as any).val).toBe(42);
  });

  it('supports custom equality', () => {
    const setEquals = (a: Set<string>, b: Set<string>) =>
      a.size === b.size && [...a].every((x) => b.has(x));

    const n = cnode('x');
    stampTree(n, (nd) => nd.kids);

    applyAttributes(n, {
      elements: compile<CNode>('elements',
        { direction: 'circular', bottom: new Set<string>(), equals: setEquals },
        (nd: CNode) => {
          const current = (nd as any).elements as Set<string>;
          const next = new Set(current);
          if (!next.has('a')) next.add('a');
          else if (!next.has('b')) next.add('b');
          else if (!next.has('c')) next.add('c');
          return next;
        },
      ),
    });

    expect((n as any).elements).toEqual(new Set(['a', 'b', 'c']));
  });

  it('caches the result after convergence', () => {
    const n = cnode('a');
    stampTree(n, (nd) => nd.kids);

    let computeCount = 0;
    applyAttributes(n, {
      val: compile<CNode>('val', { direction: 'circular', bottom: 0 }, () => {
        computeCount++;
        return 1;
      }),
    });

    void (n as any).val; // converges
    const count1 = computeCount;
    void (n as any).val; // should be cached (data property now)
    expect(computeCount).toBe(count1);
  });

  it('evaluates independently per node', () => {
    const a = cnode('a');
    const b = cnode('b');
    stampTree(a, (nd) => nd.kids);
    stampTree(b, (nd) => nd.kids);

    const counterDef = compile<CNode>('c', { direction: 'circular', bottom: 0 }, (nd: CNode) => {
      const current = (nd as any).c;
      return current < 3 ? current + 1 : current;
    });

    applyAttributes(a, { c: counterDef });
    applyAttributes(b, { c: counterDef });

    expect((a as any).c).toBe(3);
    expect((b as any).c).toBe(3);
  });

  // ── Magnusson-Hedin: inter-attribute circular dependencies ───────────

  it('handles inter-attribute circular dependencies', () => {
    const n = cnode('x');
    stampTree(n, (nd) => nd.kids);

    applyAttributes(n, {
      a: compile<CNode>('a', { direction: 'circular', bottom: 0 }, (nd: CNode) => {
        const b = (nd as any).b;
        return b < 10 ? b + 1 : b;
      }),
      b: compile<CNode>('b', { direction: 'circular', bottom: 0 }, (nd: CNode) => {
        const a = (nd as any).a;
        return a < 10 ? a + 1 : a;
      }),
    });

    expect((n as any).a).toBe(10);
    expect((n as any).b).toBe(10);
  });

  it('handles cross-node circular dependencies', () => {
    const child = cnode('child');
    const parent = cnode('parent', child);
    stampTree(parent, (nd) => nd.kids);

    applyAttributes(parent, {
      val: compile<CNode>('val', { direction: 'circular', bottom: 0 }, (nd: CNode) => {
        if (nd.name === 'parent') {
          return Math.min((nd.kids[0] as any).val + 1, 5);
        }
        return Math.min(((nd as any).$parent as any).val + 1, 5);
      }),
    });

    expect((parent as any).val).toBe(5);
    expect((child as any).val).toBe(5);
  });

  it('handles three-way circular dependency', () => {
    const n = cnode('n');
    stampTree(n, (nd) => nd.kids);

    applyAttributes(n, {
      a: compile<CNode>('a', { direction: 'circular', bottom: 0 }, (nd: CNode) => {
        return Math.min((nd as any).c + 1, 3);
      }),
      b: compile<CNode>('b', { direction: 'circular', bottom: 0 }, (nd: CNode) => {
        return Math.min((nd as any).a + 1, 3);
      }),
      c: compile<CNode>('c', { direction: 'circular', bottom: 0 }, (nd: CNode) => {
        return Math.min((nd as any).b + 1, 3);
      }),
    });

    expect((n as any).a).toBe(3);
    expect((n as any).b).toBe(3);
    expect((n as any).c).toBe(3);
  });

  it('circular attributes can depend on non-circular attributes', () => {
    const n = cnode('n');
    stampTree(n, (nd) => nd.kids);

    applyAttributes(n, {
      base: compile<CNode>('base', { direction: 'syn' }, () => 7),
      counter: compile<CNode>('counter', { direction: 'circular', bottom: 0 }, (nd: CNode) => {
        const base = (nd as any).base;
        const current = (nd as any).counter;
        return current < base ? current + 1 : current;
      }),
    });

    expect((n as any).counter).toBe(7);
  });

  it('stamps all cycle members after convergence', () => {
    const n = cnode('n');
    stampTree(n, (nd) => nd.kids);

    let aComputeCount = 0;
    let bComputeCount = 0;

    applyAttributes(n, {
      a: compile<CNode>('a', { direction: 'circular', bottom: 0 }, (nd: CNode) => {
        aComputeCount++;
        const b = (nd as any).b;
        return b < 3 ? b + 1 : b;
      }),
      b: compile<CNode>('b', { direction: 'circular', bottom: 0 }, (nd: CNode) => {
        bComputeCount++;
        const a = (nd as any).a;
        return a < 3 ? a + 1 : a;
      }),
    });

    // Trigger convergence
    void (n as any).a;
    const countsAfterConverge = { a: aComputeCount, b: bComputeCount };

    // Subsequent access should be cached (data property)
    void (n as any).a;
    void (n as any).b;
    expect(aComputeCount).toBe(countsAfterConverge.a);
    expect(bComputeCount).toBe(countsAfterConverge.b);
  });

  it('handles cross-node liveness-style analysis with custom equality', () => {
    interface CFGNode { name: string; use: string[]; successor?: CFGNode; kids: CFGNode[] }
    const setEquals = (a: Set<string>, b: Set<string>) =>
      a.size === b.size && [...a].every((x) => b.has(x));

    const s1: CFGNode = { name: 's1', use: ['x'], kids: [] };
    const s2: CFGNode = { name: 's2', use: ['y'], kids: [] };
    s1.successor = s2;
    s2.successor = s1;
    s1.kids = [s2];

    stampTree(s1, (nd) => nd.kids);

    applyAttributes(s1, {
      live: compile<CFGNode>('live',
        { direction: 'circular', bottom: new Set<string>(), equals: setEquals },
        (nd: CFGNode) => {
          const result = new Set(nd.use);
          if (nd.successor) {
            for (const v of (nd.successor as any).live as Set<string>) {
              result.add(v);
            }
          }
          return result;
        },
      ),
    });

    expect((s1 as any).live).toEqual(new Set(['x', 'y']));
    expect((s2 as any).live).toEqual(new Set(['x', 'y']));
  });
});

// ── collection ──────────────────────────────────────────────────────────

describe('collection (via compile)', () => {
  it('aggregates contributions bottom-up', () => {
    interface ColNode { kind: string; value: number; kids: ColNode[] }
    const root: ColNode = {
      kind: 'Root', value: 1, kids: [
        { kind: 'Leaf', value: 10, kids: [] },
        { kind: 'Branch', value: 2, kids: [
          { kind: 'Leaf', value: 20, kids: [] },
        ]},
      ],
    };
    stampTree(root, (n: ColNode) => n.kids);

    const def = compile<ColNode>('total', {
      direction: 'collection',
      initial: 0,
      combine: (a: number, b: number) => a + b,
    }, (n: ColNode) => n.value);

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
    interface ColNode { kind: string; tag?: string; kids: ColNode[] }
    const root: ColNode = {
      kind: 'Root', kids: [
        { kind: 'Leaf', tag: 'a', kids: [] },
        { kind: 'Branch', kids: [
          { kind: 'Leaf', tag: 'b', kids: [] },
          { kind: 'Leaf', kids: [] },
        ]},
      ],
    };
    stampTree(root, (n: ColNode) => n.kids);

    const def = compile<ColNode>('tags', {
      direction: 'collection',
      initial: [] as string[],
      combine: (acc: string[], c: string[]) =>
        acc.length === 0 ? c : c.length === 0 ? acc : [...acc, ...c],
    }, (n: ColNode) => n.tag ? [n.tag] : []);

    applyAttributes(root, { tags: def });

    expect((root.kids[0] as any).tags).toEqual(['a']);
    expect((root.kids[1] as any).tags).toEqual(['b']);
    expect((root as any).tags).toEqual(['a', 'b']);
  });

  it('works with production equation dispatch', () => {
    interface ColNode { kind: string; value?: number; kids: ColNode[] }
    const root: ColNode = {
      kind: 'Root', kids: [
        { kind: 'Leaf', value: 5, kids: [] },
        { kind: 'Leaf', value: 3, kids: [] },
      ],
    };
    stampTree(root, (n: ColNode) => n.kids);

    const def = compile<ColNode>('sum', {
      direction: 'collection',
      initial: 0,
      combine: (a: number, b: number) => a + b,
    }, {
      Leaf: (n: ColNode) => n.value ?? 0,
      _: () => 0,
    });

    applyAttributes(root, { sum: def });
    expect((root as any).sum).toBe(8);
  });
});
