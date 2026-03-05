import { describe, it, expect, vi } from 'vitest';
import { compile } from '../src/compile.js';
import { applyAttributes } from '../src/apply.js';
import { stampTree } from '../src/stamp.js';

// AST with 'kind' discriminant (like KSC)
type Leaf = { kind: 'Leaf'; value: number; children: ASTNode[] };
type Branch = { kind: 'Branch'; left: ASTNode; right: ASTNode; children: ASTNode[] };
type ASTNode = Leaf | Branch;

function leaf(value: number): Leaf {
  return { kind: 'Leaf', value, children: [] };
}
function branch(left: ASTNode, right: ASTNode): Branch {
  return { kind: 'Branch', left, right, children: [left, right] };
}

// AST with 'type' discriminant (alternative)
type TLeaf = { type: 'Leaf'; v: number; children: never[] };
type TBranch = { type: 'Branch'; l: TLeaf; r: TLeaf; children: TLeaf[] };
type TNode = TLeaf | TBranch;

describe('match / production equations (via compile)', () => {
  it('returns an AttributeDef', () => {
    const def = compile<ASTNode>('val', { direction: 'syn' }, {
      Leaf: (n: Leaf) => n.value,
      _: () => 0,
    });
    expect(typeof def.install).toBe('function');
  });

  it('dispatches to the correct equation by discriminant', () => {
    const tree = branch(leaf(3), leaf(7));
    stampTree(tree, (n) => n.children);

    const evalDef = compile<ASTNode>('eval_', { direction: 'syn' }, {
      Leaf: (n: Leaf) => n.value,
      Branch: (n: Branch) => (n.left as any).eval_ + (n.right as any).eval_,
    });

    applyAttributes(tree, { eval_: evalDef });
    expect((tree as any).eval_).toBe(10);
  });

  it('uses _ fallback for unmatched kinds', () => {
    const isLeafDef = compile<ASTNode>('isLeaf', { direction: 'syn' }, {
      Leaf: () => true,
      _: () => false,
    });

    const l = leaf(1);
    const b = branch(l, leaf(2));
    stampTree(b, (n) => n.children);
    applyAttributes(b, { isLeaf: isLeafDef });

    expect((l as any).isLeaf).toBe(true);
    expect((b as any).isLeaf).toBe(false);
  });

  it('throws when no equation matches and no _ provided', () => {
    const partial = compile<ASTNode>('val', { direction: 'syn' }, {
      Leaf: (n: Leaf) => n.value,
    });

    const b = branch(leaf(1), leaf(2));
    stampTree(b, (n) => n.children);
    applyAttributes(b, { val: partial });

    expect(() => (b as any).val).toThrow(
      "match: no equation for 'Branch' and no default '_' provided",
    );
  });

  it('caches results (lazy getter -> data property)', () => {
    const computeFn = vi.fn((n: Leaf) => n.value * 2);
    const doubled = compile<ASTNode>('doubled', { direction: 'syn' }, {
      Leaf: computeFn,
      _: () => 0,
    });

    const n = leaf(5);
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
    const tree = branch(branch(leaf(1), leaf(2)), leaf(3));
    stampTree(tree, (n) => n.children);

    const depthDef = compile<ASTNode>('depth', { direction: 'syn' }, {
      Leaf: () => 0,
      Branch: (n: Branch) => 1 + Math.max((n.left as any).depth, (n.right as any).depth),
    });

    applyAttributes(tree, { depth: depthDef });
    expect((tree as any).depth).toBe(2);
  });
});
