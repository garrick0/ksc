import { describe, it, expect } from 'vitest';
import { stampTree } from '../src/stamp.js';
import { applyAttributes } from '../src/apply.js';
import { compile } from '../src/compile.js';

interface Node { name: string; kids: Node[] }
function node(name: string, ...kids: Node[]): Node { return { name, kids }; }

describe('circular (via compile)', () => {
  it('converges on a self-referencing attribute', () => {
    const n = node('a');
    stampTree(n, (nd) => nd.kids);

    applyAttributes(n, {
      counter: compile<Node>('counter',
        { direction: 'circular', bottom: 0 },
        (nd: Node) => {
          const current = (nd as any).counter;
          return current < 5 ? current + 1 : current;
        },
      ),
    });

    expect((n as any).counter).toBe(5);
  });

  it('handles immediate convergence (init is already fixed point)', () => {
    const n = node('a');
    stampTree(n, (nd) => nd.kids);

    applyAttributes(n, {
      val: compile<Node>('val', { direction: 'circular', bottom: 42 }, () => 42),
    });

    expect((n as any).val).toBe(42);
  });

  it('supports custom equality', () => {
    const setEquals = (a: Set<string>, b: Set<string>) =>
      a.size === b.size && [...a].every((x) => b.has(x));

    const n = node('x');
    stampTree(n, (nd) => nd.kids);

    applyAttributes(n, {
      elements: compile<Node>('elements',
        { direction: 'circular', bottom: new Set<string>(), equals: setEquals },
        (nd: Node) => {
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
    const n = node('a');
    stampTree(n, (nd) => nd.kids);

    let computeCount = 0;
    applyAttributes(n, {
      val: compile<Node>('val', { direction: 'circular', bottom: 0 }, () => {
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
    const a = node('a');
    const b = node('b');
    stampTree(a, (nd) => nd.kids);
    stampTree(b, (nd) => nd.kids);

    const counterDef = compile<Node>('c', { direction: 'circular', bottom: 0 }, (nd: Node) => {
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
    const n = node('x');
    stampTree(n, (nd) => nd.kids);

    applyAttributes(n, {
      a: compile<Node>('a', { direction: 'circular', bottom: 0 }, (nd: Node) => {
        const b = (nd as any).b;
        return b < 10 ? b + 1 : b;
      }),
      b: compile<Node>('b', { direction: 'circular', bottom: 0 }, (nd: Node) => {
        const a = (nd as any).a;
        return a < 10 ? a + 1 : a;
      }),
    });

    expect((n as any).a).toBe(10);
    expect((n as any).b).toBe(10);
  });

  it('handles cross-node circular dependencies', () => {
    const child = node('child');
    const parent = node('parent', child);
    stampTree(parent, (nd) => nd.kids);

    applyAttributes(parent, {
      val: compile<Node>('val', { direction: 'circular', bottom: 0 }, (nd: Node) => {
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
    const n = node('n');
    stampTree(n, (nd) => nd.kids);

    applyAttributes(n, {
      a: compile<Node>('a', { direction: 'circular', bottom: 0 }, (nd: Node) => {
        return Math.min((nd as any).c + 1, 3);
      }),
      b: compile<Node>('b', { direction: 'circular', bottom: 0 }, (nd: Node) => {
        return Math.min((nd as any).a + 1, 3);
      }),
      c: compile<Node>('c', { direction: 'circular', bottom: 0 }, (nd: Node) => {
        return Math.min((nd as any).b + 1, 3);
      }),
    });

    expect((n as any).a).toBe(3);
    expect((n as any).b).toBe(3);
    expect((n as any).c).toBe(3);
  });

  it('circular attributes can depend on non-circular attributes', () => {
    const n = node('n');
    stampTree(n, (nd) => nd.kids);

    applyAttributes(n, {
      base: compile<Node>('base', { direction: 'syn' }, () => 7),
      counter: compile<Node>('counter', { direction: 'circular', bottom: 0 }, (nd: Node) => {
        const base = (nd as any).base;
        const current = (nd as any).counter;
        return current < base ? current + 1 : current;
      }),
    });

    expect((n as any).counter).toBe(7);
  });

  it('stamps all cycle members after convergence', () => {
    const n = node('n');
    stampTree(n, (nd) => nd.kids);

    let aComputeCount = 0;
    let bComputeCount = 0;

    applyAttributes(n, {
      a: compile<Node>('a', { direction: 'circular', bottom: 0 }, (nd: Node) => {
        aComputeCount++;
        const b = (nd as any).b;
        return b < 3 ? b + 1 : b;
      }),
      b: compile<Node>('b', { direction: 'circular', bottom: 0 }, (nd: Node) => {
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
