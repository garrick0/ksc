/**
 * Unit tests for grammar schema utility functions.
 */
import { describe, it, expect } from 'vitest';
import {
  computeFieldDefs,
  computeAllKinds,
  computeSumTypeMembers,
  computeKindMembership,
  propagateSumTypeFields,
  getChildren,
  createNode,
} from '@ksc/grammar/index.js';
import type { NodeDefShape, SumTypeDefShape } from '@ksc/grammar/index.js';

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
  Leaf: { memberOf: ['Element'], fields: {} },
  Special: { memberOf: ['Nested'], fields: { mode: { tag: 'prop', propType: "'a' | 'b'" } } },
};

const SUM_TYPES: Record<string, SumTypeDefShape> = {
  Element: {},
  Nested: { includes: ['Element'] },
  WithExtra: { fields: { extra: { tag: 'prop', propType: 'string' } }, includes: ['Element'] },
};

describe('computeFieldDefs', () => {
  const defs = computeFieldDefs(NODES);

  it('produces FieldDef[] for each kind with correct tags and defaults', () => {
    expect(Object.keys(defs)).toEqual(['Root', 'Item', 'Leaf', 'Special']);
    expect(defs['Root'][0]).toEqual({ name: 'items', tag: 'list', typeRef: 'Item' });
    expect(defs['Root'][1]).toEqual({ name: 'name', tag: 'prop', propType: 'string', default: '' });
    expect(defs['Item'].find(d => d.name === 'count')!.default).toBe(0);
    expect(defs['Item'].find(d => d.name === 'active')!.default).toBe(false);
    expect(defs['Special'].find(d => d.name === 'mode')!.default).toBe('a');
    expect(defs['Leaf']).toEqual([]);
  });
});

describe('computeSumTypeMembers + computeKindMembership', () => {
  const members = computeSumTypeMembers(NODES, SUM_TYPES);
  const membership = computeKindMembership(members);

  it('collects direct and transitive members', () => {
    expect(members['Element']).toEqual(['Item', 'Leaf']);
    expect(members['Nested']).toEqual(['Item', 'Leaf', 'Special']);
    expect(members['WithExtra']).toEqual(['Item', 'Leaf']);
  });

  it('maps each kind to its sum types', () => {
    expect(membership['Item']).toContain('Element');
    expect(membership['Item']).toContain('Nested');
    expect(membership['Item']).toContain('WithExtra');
    expect(membership['Special']).toContain('Nested');
    expect(membership['Special']).not.toContain('Element');
    expect(membership['Root']).toBeUndefined();
  });
});

describe('getChildren', () => {
  const defs = computeFieldDefs(NODES);

  it('collects children from child/optChild/list fields, skipping nulls', () => {
    const child1 = { kind: 'Leaf', pos: 0, end: 0, text: '', children: [] };
    const child2 = { kind: 'Leaf', pos: 0, end: 0, text: '', children: [] };
    const node = { kind: 'Item', pos: 0, end: 0, text: '', children: [], value: child1, label: child2, count: 5, active: true };
    expect(getChildren(node, defs)).toEqual([child1, child2]);

    const nodeNoLabel = { ...node, label: undefined };
    expect(getChildren(nodeNoLabel, defs)).toEqual([child1]);
  });

  it('returns empty for unknown kinds', () => {
    expect(getChildren({ kind: 'Unknown', pos: 0, end: 0, text: '', children: [] }, defs)).toEqual([]);
  });
});

describe('createNode', () => {
  const defs = computeFieldDefs(NODES);

  it('creates a node with defaults and populates children from child/list fields', () => {
    const child = { kind: 'Leaf', pos: 0, end: 0, text: '', children: [] };
    const node = createNode('Item', { value: child, count: 42 }, defs);
    expect(node.kind).toBe('Item');
    expect((node as any).count).toBe(42);
    expect((node as any).active).toBe(false);
    expect(node.children).toContain(child);
  });
});

describe('propagateSumTypeFields', () => {
  it('adds sum type fields to member nodes', () => {
    const nodes = JSON.parse(JSON.stringify(NODES)) as typeof NODES;
    const members = computeSumTypeMembers(nodes, SUM_TYPES);
    propagateSumTypeFields(nodes, SUM_TYPES, members);
    expect(nodes['Item'].fields).toHaveProperty('extra');
    expect((nodes['Item'].fields as any)['extra']).toEqual({ tag: 'prop', propType: 'string' });
    expect(nodes['Leaf'].fields).toHaveProperty('extra');
  });

  it('does not overwrite existing fields on members', () => {
    const nodes = JSON.parse(JSON.stringify(NODES)) as typeof NODES;
    (nodes['Item'].fields as any)['extra'] = { tag: 'prop', propType: 'number' };
    const members = computeSumTypeMembers(nodes, SUM_TYPES);
    propagateSumTypeFields(nodes, SUM_TYPES, members);
    expect((nodes['Item'].fields as any)['extra'].propType).toBe('number');
  });
});
