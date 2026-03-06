/**
 * Tests for the three-object architecture: Grammar + Semantics + interpret().
 * Also tests stampTree (tree navigation stamping).
 */
import { describe, it, expect } from 'vitest';
import { createGrammar } from '../src/grammar.js';
import { createSemantics } from '../src/semantics.js';
import { interpret, stampTree } from '../src/interpret.js';
import type { SpecInput } from '../src/spec.js';

// ── Test tree ───────────────────────────────────────────────────────────

interface TNode {
  type: string;
  value: number;
  kids: TNode[];
}

function getChildren(node: TNode): TNode[] {
  return node.kids;
}

function makeTree(): TNode {
  return {
    type: 'root',
    value: 10,
    kids: [
      { type: 'leaf', value: 20, kids: [] },
      {
        type: 'branch',
        value: 30,
        kids: [
          { type: 'leaf', value: 40, kids: [] },
        ],
      },
    ],
  };
}

// ── stampTree ────────────────────────────────────────────────────────────

interface SNode {
  name: string;
  kids: SNode[];
}

function snode(name: string, ...kids: SNode[]): SNode {
  return { name, kids };
}

describe('stampTree', () => {
  //       a
  //      / \
  //     b   c
  //    / \
  //   d   e
  const d = snode('d');
  const e = snode('e');
  const b = snode('b', d, e);
  const c = snode('c');
  const a = snode('a', b, c);

  // Stamp before tests
  stampTree(a, (n) => n.kids);

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
    const single = snode('solo');
    stampTree(single, (n) => n.kids);

    expect((single as any).$root).toBe(true);
    expect((single as any).$parent).toBeUndefined();
    expect((single as any).$children).toEqual([]);
    expect((single as any).$index).toBe(-1);
    expect((single as any).$prev).toBeUndefined();
    expect((single as any).$next).toBeUndefined();
  });
});

// ── interpret() ──────────────────────────────────────────────────────────

describe('interpret', () => {
  it('stamps tree navigation and installs attributes', () => {
    const root = makeTree();
    const grammar = createGrammar(getChildren);

    const spec: SpecInput<TNode> = {
      name: 'test-basic',
      declarations: { doubled: { direction: 'syn' } },
      equations: { doubled: (n: TNode) => n.value * 2 },
    };

    const semantics = createSemantics(grammar, [spec]);
    interpret(semantics, root);

    // Tree navigation stamped
    expect((root as any).$root).toBe(true);
    expect((root as any).$children).toEqual(root.kids);
    expect((root.kids[0] as any).$parent).toBe(root);

    // Attribute works
    expect((root as any).doubled).toBe(20);
    expect((root.kids[0] as any).doubled).toBe(40);
  });

  it('returns projected result when defined', () => {
    const root = makeTree();
    const grammar = createGrammar(getChildren);

    const spec: SpecInput<TNode, number> = {
      name: 'test-project',
      declarations: { doubled: { direction: 'syn' } },
      equations: { doubled: (n: TNode) => n.value * 2 },
      project: (r) => {
        let total = 0;
        const stack: TNode[] = [r];
        while (stack.length > 0) {
          const n = stack.pop()!;
          total += (n as any).doubled;
          stack.push(...(n as any).$children);
        }
        return total;
      },
    };

    const semantics = createSemantics(grammar, [spec]);
    const results = interpret(semantics, root);
    // (10 + 20 + 30 + 40) * 2 = 200
    expect(results.get('test-project')).toBe(200);
  });

  it('returns empty map when spec has no project', () => {
    const root = makeTree();
    const grammar = createGrammar(getChildren);

    const spec: SpecInput<TNode> = {
      name: 'test-no-project',
      declarations: { doubled: { direction: 'syn' } },
      equations: { doubled: (n: TNode) => n.value * 2 },
    };

    const semantics = createSemantics(grammar, [spec]);
    const results = interpret(semantics, root);
    expect(results.has('test-no-project')).toBe(false);
  });

  it('works with production equation dispatch', () => {
    const root = makeTree();
    const grammar = createGrammar(getChildren);

    const spec: SpecInput<TNode, string[]> = {
      name: 'test-match',
      declarations: { label: { direction: 'syn', discriminant: 'type' } },
      equations: {
        label: {
          root: () => 'ROOT',
          branch: () => 'BRANCH',
          leaf: () => 'LEAF',
        },
      },
      project: (r) => {
        const labels: string[] = [];
        const stack: TNode[] = [r];
        while (stack.length > 0) {
          const n = stack.pop()!;
          labels.push((n as any).label);
          stack.push(...(n as any).$children);
        }
        return labels.sort();
      },
    };

    const semantics = createSemantics(grammar, [spec]);
    const results = interpret(semantics, root);
    expect(results.get('test-match')).toEqual(['BRANCH', 'LEAF', 'LEAF', 'ROOT']);
  });

  it('works with subtree aggregation', () => {
    const root = makeTree();
    const grammar = createGrammar(getChildren);

    const spec: SpecInput<TNode, number> = {
      name: 'test-sum',
      declarations: { sum: { direction: 'syn' } },
      equations: {
        sum: (node: TNode) => {
          let total = 0;
          const stack: TNode[] = [node];
          while (stack.length > 0) {
            const n = stack.pop()!;
            total += n.value;
            stack.push(...((n as any).$children ?? []));
          }
          return total;
        },
      },
      project: (r) => (r as any).sum,
    };

    const semantics = createSemantics(grammar, [spec]);
    const results = interpret(semantics, root);
    expect(results.get('test-sum')).toBe(100);
  });

  it('works with inherited attributes', () => {
    const root = makeTree();
    const grammar = createGrammar(getChildren);

    const spec: SpecInput<TNode> = {
      name: 'test-inh',
      declarations: { depth: { direction: 'inh', root: 0 } },
      equations: {
        depth: (parent: TNode) => (parent as any).depth + 1,
      },
    };

    const semantics = createSemantics(grammar, [spec]);
    interpret(semantics, root);

    expect((root as any).depth).toBe(0);
    expect((root.kids[0] as any).depth).toBe(1);
    expect((root.kids[1].kids[0] as any).depth).toBe(2);
  });
});

// ── Multi-spec evaluation ────────────────────────────────────────────────

describe('multi-spec evaluation', () => {
  it('applies multiple specs in dependency order', () => {
    const root = makeTree();
    const grammar = createGrammar(getChildren);

    const specA: SpecInput<TNode> = {
      name: 'phase-a',
      declarations: { doubled: { direction: 'syn' } },
      equations: { doubled: (n: TNode) => n.value * 2 },
    };

    const specB: SpecInput<TNode, number> = {
      name: 'phase-b',
      declarations: { tripled: { direction: 'syn' } },
      equations: { tripled: (n: TNode) => (n as any).doubled * 3 },
      deps: ['phase-a'],
      project: (r) => (r as any).tripled,
    };

    // Pass in reverse order — createSemantics should sort them
    const semantics = createSemantics(grammar, [specB, specA]);
    const results = interpret(semantics, root);

    expect((root as any).doubled).toBe(20);
    expect((root as any).tripled).toBe(60);
    expect(results.get('phase-b')).toBe(60);
  });

  it('stamps tree only once', () => {
    const root = makeTree();
    let childrenCallCount = 0;

    const countingChildren = (n: TNode): TNode[] => {
      childrenCallCount++;
      return n.kids;
    };

    const grammar = createGrammar(countingChildren);

    const specA: SpecInput<TNode> = {
      name: 'a',
      declarations: { x: { direction: 'syn' } },
      equations: { x: (n: TNode) => n.value },
    };

    const specB: SpecInput<TNode> = {
      name: 'b',
      declarations: { y: { direction: 'syn' } },
      equations: { y: (n: TNode) => n.value * 2 },
    };

    const semantics = createSemantics(grammar, [specA, specB]);
    interpret(semantics, root);

    // stampTree calls getChildren once per node (4 nodes).
    expect(childrenCallCount).toBe(4);
  });

  it('throws on circular dependencies', () => {
    const grammar = createGrammar(getChildren);

    const specA: SpecInput<TNode> = {
      name: 'a',
      declarations: {},
      equations: {},
      deps: ['b'],
    };

    const specB: SpecInput<TNode> = {
      name: 'b',
      declarations: {},
      equations: {},
      deps: ['a'],
    };

    expect(() => createSemantics(grammar, [specA, specB]))
      .toThrow(/Circular dependency/);
  });

  it('throws on unknown dependencies', () => {
    const grammar = createGrammar(getChildren);

    const spec: SpecInput<TNode> = {
      name: 'a',
      declarations: {},
      equations: {},
      deps: ['nonexistent'],
    };

    expect(() => createSemantics(grammar, [spec]))
      .toThrow(/Unknown dependency/);
  });

  it('works with no specs', () => {
    const root = makeTree();
    const grammar = createGrammar(getChildren);
    const semantics = createSemantics(grammar, []);
    const results = interpret(semantics, root);
    expect(results.size).toBe(0);
  });
});
