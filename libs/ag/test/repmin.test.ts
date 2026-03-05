/**
 * Classic repmin integration test.
 *
 * Uses compile() to create attributes:
 * - syn (locmin: local minimum, bottom-up)
 * - inh (globmin: global minimum, inherited from root)
 * - syn (repmin: rebuilt tree using inherited globmin)
 */
import { describe, it, expect } from 'vitest';
import { compile } from '../src/compile.js';
import { stampTree } from '../src/stamp.js';
import { applyAttributes } from '../src/apply.js';

// Binary tree type
type RepTree = RepLeaf | RepFork;
interface RepLeaf { type: 'Leaf'; value: number }
interface RepFork { type: 'Fork'; left: RepTree; right: RepTree }

function leaf(value: number): RepLeaf { return { type: 'Leaf', value }; }
function fork(left: RepTree, right: RepTree): RepFork { return { type: 'Fork', left, right }; }

function getChildren(n: RepTree): RepTree[] {
  if (n.type === 'Fork') return [n.left, n.right];
  return [];
}

describe('repmin', () => {
  it('replaces all leaves with the global minimum', () => {
    const t = fork(fork(leaf(3), leaf(7)), leaf(5));
    stampTree(t, getChildren);

    applyAttributes(t, {
      locmin: compile<RepTree>('locmin', { direction: 'syn' }, (node: RepTree) => {
        if (node.type === 'Leaf') return node.value;
        return Math.min((node.left as any).locmin, (node.right as any).locmin);
      }),
      globmin: compile<RepTree>('globmin',
        { direction: 'inh', root: (root: RepTree) => {
          if (root.type === 'Leaf') return root.value;
          return Math.min((root.left as any).locmin, (root.right as any).locmin);
        }},
        undefined,
      ),
      repmin: compile<RepTree>('repmin', { direction: 'syn' }, (node: RepTree) => {
        if (node.type === 'Leaf') return leaf((node as any).globmin);
        return fork((node.left as any).repmin, (node.right as any).repmin);
      }),
    });

    const result = (t as any).repmin;
    expect(result).toEqual(
      fork(fork(leaf(3), leaf(3)), leaf(3)),
    );
  });

  it('works with a single leaf', () => {
    const t = leaf(42);
    stampTree(t, getChildren);

    applyAttributes(t, {
      locmin: compile<RepTree>('locmin', { direction: 'syn' }, (node: RepTree) => {
        if (node.type === 'Leaf') return node.value;
        return Math.min((node.left as any).locmin, (node.right as any).locmin);
      }),
      globmin: compile<RepTree>('globmin',
        { direction: 'inh', root: (root: RepTree) => (root as any).locmin },
        undefined,
      ),
      repmin: compile<RepTree>('repmin', { direction: 'syn' }, (node: RepTree) => {
        if (node.type === 'Leaf') return leaf((node as any).globmin);
        return fork((node.left as any).repmin, (node.right as any).repmin);
      }),
    });

    expect((t as any).repmin).toEqual(leaf(42));
  });

  it('handles deep tree', () => {
    const t = fork(fork(fork(leaf(10), leaf(1)), leaf(8)), leaf(4));
    stampTree(t, getChildren);

    applyAttributes(t, {
      locmin: compile<RepTree>('locmin', { direction: 'syn' }, (node: RepTree) => {
        if (node.type === 'Leaf') return node.value;
        return Math.min((node.left as any).locmin, (node.right as any).locmin);
      }),
      globmin: compile<RepTree>('globmin',
        { direction: 'inh', root: (root: RepTree) => (root as any).locmin },
        undefined,
      ),
      repmin: compile<RepTree>('repmin', { direction: 'syn' }, (node: RepTree) => {
        if (node.type === 'Leaf') return leaf((node as any).globmin);
        return fork((node.left as any).repmin, (node.right as any).repmin);
      }),
    });

    expect((t as any).locmin).toBe(1);
    const result = (t as any).repmin;
    const collectLeaves = (n: RepTree): number[] => {
      if (n.type === 'Leaf') return [n.value];
      return [...collectLeaves(n.left), ...collectLeaves(n.right)];
    };
    expect(collectLeaves(result)).toEqual([1, 1, 1, 1]);
  });
});
