/**
 * Unit tests for grammar/schema-utils.ts — pure utility functions.
 */
import { describe, it, expect } from 'vitest';
import {
  computeFieldDefs,
  computeAllKinds,
  computeSumTypeMembers,
  computeKindMembership,
  createTypeGuard,
  propagateSumTypeFields,
  getChildren,
  createNode,
} from '../../grammar/index.js';
import type { NodeDefShape, SumTypeDefShape } from '../../grammar/index.js';

// ── Test schema ──

const NODES: Record<string, NodeDefShape> = {
  Root: {
    memberOf: [],
    fields: {
      items: { tag: 'list', typeRef: 'Item' },
      name: { tag: 'prop', propType: 'string' },
    },
  },
  Item: {
    memberOf: ['Element'],
    fields: {
      value: { tag: 'child' },
      label: { tag: 'optChild' },
      count: { tag: 'prop', propType: 'number' },
      active: { tag: 'prop', propType: 'boolean' },
    },
  },
  Leaf: {
    memberOf: ['Element'],
    fields: {},
  },
  Special: {
    memberOf: ['Nested'],
    fields: {
      mode: { tag: 'prop', propType: "'a' | 'b'" },
    },
  },
};

const SUM_TYPES: Record<string, SumTypeDefShape> = {
  Element: {},
  Nested: { includes: ['Element'] },
  WithExtra: {
    fields: { extra: { tag: 'prop', propType: 'string' } },
    includes: ['Element'],
  },
};

// ── Tests ──

describe('computeFieldDefs', () => {
  const defs = computeFieldDefs(NODES);

  it('produces FieldDef[] for each kind', () => {
    expect(Object.keys(defs)).toEqual(['Root', 'Item', 'Leaf', 'Special']);
  });

  it('maps child/list/optChild tags correctly', () => {
    const rootDefs = defs['Root'];
    expect(rootDefs).toHaveLength(2);
    expect(rootDefs[0]).toEqual({ name: 'items', tag: 'list', typeRef: 'Item' });
    expect(rootDefs[1]).toEqual({ name: 'name', tag: 'prop', propType: 'string', default: '' });
  });

  it('computes correct defaults for prop types', () => {
    const itemDefs = defs['Item'];
    const countDef = itemDefs.find(d => d.name === 'count')!;
    const activeDef = itemDefs.find(d => d.name === 'active')!;
    expect(countDef.default).toBe(0);
    expect(activeDef.default).toBe(false);
  });

  it('defaults union literal props to first option', () => {
    const specialDefs = defs['Special'];
    const modeDef = specialDefs.find(d => d.name === 'mode')!;
    expect(modeDef.default).toBe('a');
  });

  it('produces empty array for nodes with no fields', () => {
    expect(defs['Leaf']).toEqual([]);
  });
});

describe('computeAllKinds', () => {
  it('returns a set of all node kind strings', () => {
    const kinds = computeAllKinds(NODES);
    expect(kinds).toEqual(new Set(['Root', 'Item', 'Leaf', 'Special']));
  });
});

describe('computeSumTypeMembers', () => {
  const members = computeSumTypeMembers(NODES, SUM_TYPES);

  it('collects direct members from memberOf', () => {
    expect(members['Element']).toEqual(['Item', 'Leaf']);
  });

  it('resolves transitive includes', () => {
    // Nested includes Element, so it should have Item + Leaf + Special
    expect(members['Nested']).toEqual(['Item', 'Leaf', 'Special']);
  });

  it('resolves includes for sum types with fields', () => {
    expect(members['WithExtra']).toEqual(['Item', 'Leaf']);
  });
});

describe('computeKindMembership', () => {
  const members = computeSumTypeMembers(NODES, SUM_TYPES);
  const membership = computeKindMembership(members);

  it('maps each kind to its sum types', () => {
    expect(membership['Item']).toContain('Element');
    expect(membership['Item']).toContain('Nested');
    expect(membership['Item']).toContain('WithExtra');
  });

  it('includes direct and transitive membership', () => {
    expect(membership['Special']).toContain('Nested');
    expect(membership['Special']).not.toContain('Element');
  });

  it('omits kinds with no sum type membership', () => {
    expect(membership['Root']).toBeUndefined();
  });
});

describe('createTypeGuard', () => {
  const isElement = createTypeGuard(['Item', 'Leaf']);

  it('returns true for member kinds', () => {
    expect(isElement({ kind: 'Item', pos: 0, end: 0, text: '', children: [] })).toBe(true);
    expect(isElement({ kind: 'Leaf', pos: 0, end: 0, text: '', children: [] })).toBe(true);
  });

  it('returns false for non-member kinds', () => {
    expect(isElement({ kind: 'Root', pos: 0, end: 0, text: '', children: [] })).toBe(false);
  });
});

describe('getChildren', () => {
  const defs = computeFieldDefs(NODES);

  it('collects children from child/optChild/list fields', () => {
    const child1 = { kind: 'Leaf', pos: 0, end: 0, text: '', children: [] };
    const child2 = { kind: 'Leaf', pos: 0, end: 0, text: '', children: [] };
    const node = {
      kind: 'Item',
      pos: 0, end: 0, text: '', children: [],
      value: child1,
      label: child2,
      count: 5,
      active: true,
    };
    const result = getChildren(node, defs);
    expect(result).toEqual([child1, child2]);
  });

  it('skips null optChild fields', () => {
    const child1 = { kind: 'Leaf', pos: 0, end: 0, text: '', children: [] };
    const node = {
      kind: 'Item',
      pos: 0, end: 0, text: '', children: [],
      value: child1,
      label: undefined,
      count: 0,
      active: false,
    };
    const result = getChildren(node, defs);
    expect(result).toEqual([child1]);
  });

  it('returns empty for unknown kinds', () => {
    const node = { kind: 'Unknown', pos: 0, end: 0, text: '', children: [] };
    expect(getChildren(node, defs)).toEqual([]);
  });

  it('collects list children', () => {
    const items = [
      { kind: 'Leaf', pos: 0, end: 1, text: 'a', children: [] },
      { kind: 'Leaf', pos: 2, end: 3, text: 'b', children: [] },
    ];
    const node = {
      kind: 'Root',
      pos: 0, end: 10, text: '', children: [],
      items,
      name: 'test',
    };
    const result = getChildren(node, defs);
    expect(result).toEqual(items);
  });
});

describe('createNode', () => {
  const defs = computeFieldDefs(NODES);

  it('creates a node with defaults for missing fields', () => {
    const node = createNode('Item', {}, defs);
    expect(node.kind).toBe('Item');
    expect((node as any).count).toBe(0);
    expect((node as any).active).toBe(false);
    expect((node as any).value).toBeUndefined();
    expect((node as any).label).toBeUndefined();
  });

  it('uses provided field values', () => {
    const child = { kind: 'Leaf', pos: 0, end: 0, text: '', children: [] };
    const node = createNode('Item', { value: child, count: 42, active: true }, defs);
    expect((node as any).value).toBe(child);
    expect((node as any).count).toBe(42);
    expect((node as any).active).toBe(true);
    expect(node.children).toContain(child);
  });

  it('populates children array from child/list fields', () => {
    const items = [
      { kind: 'Leaf', pos: 0, end: 1, text: 'a', children: [] },
      { kind: 'Leaf', pos: 2, end: 3, text: 'b', children: [] },
    ];
    const node = createNode('Root', { items, name: 'test' }, defs);
    expect(node.children).toEqual(items);
    expect((node as any).name).toBe('test');
  });
});

describe('propagateSumTypeFields', () => {
  it('adds sum type fields to member nodes that lack them', () => {
    const nodes = JSON.parse(JSON.stringify(NODES)) as typeof NODES;
    const members = computeSumTypeMembers(nodes, SUM_TYPES);
    propagateSumTypeFields(nodes, SUM_TYPES, members);

    // WithExtra has an 'extra' field — should propagate to Item and Leaf (its members)
    expect(nodes['Item'].fields).toHaveProperty('extra');
    expect((nodes['Item'].fields as any)['extra']).toEqual({ tag: 'prop', propType: 'string' });
    expect(nodes['Leaf'].fields).toHaveProperty('extra');
  });

  it('does not overwrite existing fields on members', () => {
    const nodes = JSON.parse(JSON.stringify(NODES)) as typeof NODES;
    // Give Item a pre-existing 'extra' field
    (nodes['Item'].fields as any)['extra'] = { tag: 'prop', propType: 'number' };
    const members = computeSumTypeMembers(nodes, SUM_TYPES);
    propagateSumTypeFields(nodes, SUM_TYPES, members);

    // Should keep the original number type, not overwrite with string
    expect((nodes['Item'].fields as any)['extra'].propType).toBe('number');
  });

  it('does nothing when sum types have no fields', () => {
    const nodes = JSON.parse(JSON.stringify(NODES)) as typeof NODES;
    const members = computeSumTypeMembers(nodes, SUM_TYPES);
    const before = JSON.stringify(nodes['Special']);
    propagateSumTypeFields(nodes, SUM_TYPES, members);
    // Special is only in Nested, which has no fields
    expect(JSON.stringify(nodes['Special'])).toBe(before);
  });
});
