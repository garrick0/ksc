import { describe, it, expect } from 'vitest';
import { serializeTree, deserializeTree } from '../src/serialize.js';
import { stampTree } from '../src/stamp.js';
import { applyAttributes } from '../src/apply.js';
import { compile } from '../src/compile.js';

// Simple tree node type
interface TNode {
  kind: string;
  name: string;
  value?: number;
  kids: TNode[];
}

function node(kind: string, name: string, ...kids: TNode[]): TNode {
  return { kind, name, kids };
}

function leaf(name: string, value?: number): TNode {
  return { kind: 'Leaf', name, value, kids: [] };
}

function getChildren(n: TNode): TNode[] {
  return n.kids;
}

// ────────────────────────────────────────────────────────────────────────

describe('serializeTree', () => {
  it('serializes a simple tree preserving structural fields', () => {
    const root = node('Root', 'r', leaf('a', 10), leaf('b', 20));
    stampTree(root, getChildren);

    const result = serializeTree(root, getChildren, { childrenKey: 'kids' }) as any;

    expect(result.kind).toBe('Root');
    expect(result.name).toBe('r');
    expect(result.kids).toBeUndefined(); // original key is replaced by 'children'
    expect(result.children).toHaveLength(2);
    expect(result.children[0].name).toBe('a');
    expect(result.children[0].value).toBe(10);
  });

  it('strips $parent, $prev, $next navigation properties', () => {
    const root = node('Root', 'r', leaf('a'), leaf('b'));
    stampTree(root, getChildren);

    const result = serializeTree(root, getChildren, { childrenKey: 'kids' }) as any;

    expect(result.$parent).toBeUndefined();
    expect(result.$children).toBeUndefined();
    expect(result.$prev).toBeUndefined();
    expect(result.$next).toBeUndefined();
    expect(result.$root).toBeUndefined();
    expect(result.$index).toBeUndefined();
  });

  it('excludes AG attributes by default', () => {
    const root = node('Root', 'r', leaf('a', 10), leaf('b', 20));
    stampTree(root, getChildren);

    const sumAttr = compile<TNode>('sum', { direction: 'syn' }, (n: TNode) => {
      if (n.kind === 'Leaf') return n.value ?? 0;
      return getChildren(n).reduce((acc, c) => acc + (c as any).sum, 0);
    });
    applyAttributes(root, { sum: sumAttr });

    // Trigger computation
    expect((root as any).sum).toBe(30);

    const result = serializeTree(root, getChildren, { childrenKey: 'kids' }) as any;
    expect(result.sum).toBeUndefined();
  });

  it('includes AG attributes when requested', () => {
    const root = node('Root', 'r', leaf('a', 10), leaf('b', 20));
    stampTree(root, getChildren);

    const sumAttr = compile<TNode>('sum', { direction: 'syn' }, (n: TNode) => {
      if (n.kind === 'Leaf') return n.value ?? 0;
      return getChildren(n).reduce((acc, c) => acc + (c as any).sum, 0);
    });
    applyAttributes(root, { sum: sumAttr });

    // Trigger computation
    expect((root as any).sum).toBe(30);

    const result = serializeTree(root, getChildren, {
      childrenKey: 'kids',
      includeAttributes: true,
      attributeFilter: ['sum'],
    }) as any;

    expect(result.sum).toBe(30);
    expect(result.children[0].sum).toBe(10);
    expect(result.children[1].sum).toBe(20);
  });

  it('excludeKeys filters custom properties', () => {
    const root = { kind: 'Root', name: 'r', secret: 'hidden', kids: [] as TNode[] };
    stampTree(root, getChildren);

    const result = serializeTree(root, getChildren, {
      childrenKey: 'kids',
      excludeKeys: ['secret'],
    }) as any;

    expect(result.secret).toBeUndefined();
    expect(result.name).toBe('r');
  });

  it('serializes Set values as arrays when includeAttributes is true', () => {
    const root = { kind: 'Root', name: 'r', tags: new Set(['a', 'b']), kids: [] as TNode[] };
    stampTree(root, getChildren);

    const result = serializeTree(root, getChildren, {
      childrenKey: 'kids',
      includeAttributes: true,
      attributeFilter: ['tags'],
    }) as any;
    expect(result.tags).toEqual(['a', 'b']);
  });

  it('serializes Set values from regular properties too', () => {
    const root = { kind: 'Root', name: 'r', tags: new Set(['a', 'b']), kids: [] as TNode[] };
    stampTree(root, getChildren);

    // tags is a regular property (not AG-computed), so it's always serialized
    const result = serializeTree(root, getChildren, { childrenKey: 'kids' }) as any;
    expect(result.tags).toEqual(['a', 'b']);
  });

  it('result is JSON-safe (no circular refs)', () => {
    const root = node('Root', 'r', leaf('a'), leaf('b'));
    stampTree(root, getChildren);

    const result = serializeTree(root, getChildren, { childrenKey: 'kids' });
    const json = JSON.stringify(result);
    expect(json).toBeTruthy();

    const parsed = JSON.parse(json);
    expect(parsed.kind).toBe('Root');
    expect(parsed.children).toHaveLength(2);
  });
});

describe('$agAttrs tracking', () => {
  it('stamps $agAttrs as a non-enumerable Set on nodes after applyAttributes', () => {
    const root = node('Root', 'r', leaf('a', 10), leaf('b', 20));
    stampTree(root, getChildren);

    const sumAttr = compile<TNode>('sum', { direction: 'syn' }, (n: TNode) => {
      if (n.kind === 'Leaf') return n.value ?? 0;
      return getChildren(n).reduce((acc, c) => acc + (c as any).sum, 0);
    });
    applyAttributes(root, { sum: sumAttr });

    const agAttrs: Set<string> = (root as any).$agAttrs;
    expect(agAttrs).toBeInstanceOf(Set);
    expect(agAttrs.has('sum')).toBe(true);

    // Non-enumerable
    expect(Object.keys(root)).not.toContain('$agAttrs');

    // Children also have it
    const childAttrs: Set<string> = (getChildren(root)[0] as any).$agAttrs;
    expect(childAttrs).toBeInstanceOf(Set);
    expect(childAttrs.has('sum')).toBe(true);
  });

  it('accumulates attributes from multiple applyAttributes calls', () => {
    const root = node('Root', 'r', leaf('a', 10));
    stampTree(root, getChildren);

    const attr1 = compile<TNode>('first', { direction: 'syn' }, () => 1);
    const attr2 = compile<TNode>('second', { direction: 'syn' }, () => 2);
    applyAttributes(root, { first: attr1 });
    applyAttributes(root, { second: attr2 });

    const agAttrs: Set<string> = (root as any).$agAttrs;
    expect(agAttrs.has('first')).toBe(true);
    expect(agAttrs.has('second')).toBe(true);
  });

  it('serializer uses $agAttrs to filter attributes correctly', () => {
    const root = node('Root', 'r', leaf('a', 10));
    stampTree(root, getChildren);

    const sumAttr = compile<TNode>('sum', { direction: 'syn' }, (n: TNode) => {
      if (n.kind === 'Leaf') return n.value ?? 0;
      return getChildren(n).reduce((acc, c) => acc + (c as any).sum, 0);
    });
    applyAttributes(root, { sum: sumAttr });

    // Without includeAttributes, AG attributes are excluded
    const without = serializeTree(root, getChildren, { childrenKey: 'kids' }) as any;
    expect(without.sum).toBeUndefined();

    // With includeAttributes + filter, AG attributes are included
    const with_ = serializeTree(root, getChildren, {
      childrenKey: 'kids',
      includeAttributes: true,
      attributeFilter: ['sum'],
    }) as any;
    expect(with_.sum).toBe(10);
    expect(with_.children[0].sum).toBe(10);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('deserializeTree', () => {
  it('stamps navigation properties on deserialized data', () => {
    const data = {
      kind: 'Root',
      name: 'r',
      children: [
        { kind: 'Leaf', name: 'a', value: 10, children: [] },
        { kind: 'Leaf', name: 'b', value: 20, children: [] },
      ],
    };

    type DNode = { kind: string; name: string; value?: number; children: DNode[] };
    const root = deserializeTree<DNode>(data, n => n.children);

    expect((root as any).$root).toBe(true);
    expect((root as any).$parent).toBeUndefined();
    expect((root as any).$children).toHaveLength(2);

    const a = root.children[0];
    expect((a as any).$parent).toBe(root);
    expect((a as any).$index).toBe(0);
    expect((a as any).$root).toBe(false);
  });

  it('round-trips through serialize → JSON → deserialize', () => {
    const root = node('Root', 'r', leaf('a', 10), leaf('b', 20));
    stampTree(root, getChildren);

    // Serialize (original uses 'kids', output uses 'children')
    const serialized = serializeTree(root, getChildren, { childrenKey: 'kids' });
    const json = JSON.stringify(serialized);
    const parsed = JSON.parse(json);

    // Deserialize (using 'children' field since that's what serializeTree produces)
    type DNode = { kind: string; name: string; value?: number; children: DNode[] };
    const restored = deserializeTree<DNode>(parsed, n => n.children);

    expect(restored.kind).toBe('Root');
    expect(restored.children).toHaveLength(2);
    expect(restored.children[0].name).toBe('a');
    expect(restored.children[0].value).toBe(10);
    expect((restored as any).$root).toBe(true);
    expect((restored.children[0] as any).$parent).toBe(restored);
  });

  it('deserialized tree supports AG attribute evaluation', () => {
    const data = {
      kind: 'Root',
      name: 'r',
      children: [
        { kind: 'Leaf', name: 'a', value: 10, children: [] },
        { kind: 'Leaf', name: 'b', value: 20, children: [] },
      ],
    };

    type DNode = { kind: string; name: string; value?: number; children: DNode[] };
    const root = deserializeTree<DNode>(data, n => n.children);

    // Apply an AG attribute to the deserialized tree
    const sumAttr = compile<DNode>('sum', { direction: 'syn' }, {
      Leaf: (n: DNode) => n.value ?? 0,
      Root: (n: DNode) => (n as any).$children.reduce((acc: number, c: any) => acc + c.sum, 0),
    });
    applyAttributes(root, { sum: sumAttr });

    expect((root as any).sum).toBe(30);
    expect((root.children[0] as any).sum).toBe(10);
  });
});
