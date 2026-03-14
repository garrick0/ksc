/**
 * Grammar metadata computation — pure functions for computing runtime metadata
 * from grammar schemas (nodes/sumTypes).
 *
 * All functions take a schema as input. No module-level state, no imports from adapters/.
 * Reusable for any grammar (TS AST, mock, future).
 */

import type { FieldDef, ChildFieldDef, PropFieldDef } from '../domain/ports.js';
import type { FieldDescShape, NodeDefShape, SumTypeDefShape } from '../domain/schema-shapes.js';

// ═══════════════════════════════════════════════════════════════════════
// Field metadata computation
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compute the default value literal for a prop field type.
 */
function propDefault(propType: string): unknown {
  if (propType === 'boolean') return false;
  if (propType === 'string') return '';
  if (propType === 'number') return 0;
  if (propType === 'readonly number[]') return [];
  // Union literals — default to first option
  const match = propType.match(/^'([^']+)'/);
  if (match) return match[1];
  return undefined;
}

/**
 * Compute canonical FieldDef[] arrays from a nodes schema.
 * Pure function — takes schema as input, returns computed fieldDefs.
 */
export function computeFieldDefs(
  nodes: Record<string, NodeDefShape>,
): Readonly<Record<string, readonly FieldDef[]>> {
  const result: Record<string, FieldDef[]> = {};

  for (const [kind, entry] of Object.entries(nodes)) {
    const fields = Object.entries(entry.fields);
    if (fields.length === 0) {
      result[kind] = [];
    } else {
      result[kind] = fields.map(([name, field]): FieldDef => {
        if (field.tag === 'prop') {
          const def: PropFieldDef = { name, tag: 'prop', propType: field.propType };
          const d = propDefault(field.propType);
          if (d !== undefined) def.default = d;
          return def;
        } else {
          const def: ChildFieldDef = { name, tag: field.tag };
          if (field.typeRef) def.typeRef = field.typeRef;
          return def;
        }
      });
    }
  }

  return result;
}

/**
 * Compute the set of all node kind strings from a nodes schema.
 */
export function computeAllKinds(
  nodes: Record<string, NodeDefShape>,
): ReadonlySet<string> {
  return new Set(Object.keys(nodes));
}

// ═══════════════════════════════════════════════════════════════════════
// Sum type membership
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compute sum type membership table from nodes schema.
 * Returns Record<sumTypeName, memberKindStrings[]>.
 */
export function computeSumTypeMembers(
  nodes: Record<string, NodeDefShape>,
  sumTypes: Record<string, SumTypeDefShape>,
): Readonly<Record<string, readonly string[]>> {
  // Build direct membership
  const members: Record<string, Set<string>> = {};
  for (const name of Object.keys(sumTypes)) {
    members[name] = new Set<string>();
  }

  // Collect from node memberOf declarations
  for (const [kind, entry] of Object.entries(nodes)) {
    for (const st of entry.memberOf) {
      if (members[st]) members[st].add(kind);
    }
  }

  // Resolve transitive includes
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, stDef] of Object.entries(sumTypes)) {
      if (!stDef.includes) continue;
      for (const inc of stDef.includes) {
        if (!members[inc]) continue;
        for (const kind of members[inc]) {
          if (!members[name].has(kind)) {
            members[name].add(kind);
            changed = true;
          }
        }
      }
    }
  }

  // Convert to sorted arrays
  const result: Record<string, string[]> = {};
  for (const [name, set] of Object.entries(members)) {
    result[name] = [...set].sort();
  }
  return result;
}

/**
 * Compute inverse membership: for each kind, which sum types does it belong to?
 */
export function computeKindMembership(
  sumTypeMembers: Readonly<Record<string, readonly string[]>>,
): Readonly<Record<string, readonly string[]>> {
  const m: Record<string, string[]> = {};
  for (const [name, kinds] of Object.entries(sumTypeMembers)) {
    for (const kind of kinds) {
      (m[kind] ??= []).push(name);
    }
  }
  return m;
}

// ═══════════════════════════════════════════════════════════════════════
// Type guards
// ═══════════════════════════════════════════════════════════════════════

/**
 * Create a type guard function for a sum type given its member kinds.
 */
export function createTypeGuard(
  memberKinds: readonly string[],
): (node: import('../domain/ports.js').ASTNode) => boolean {
  const set = new Set(memberKinds);
  return (node: import('../domain/ports.js').ASTNode) => set.has(node.kind);
}

// ═══════════════════════════════════════════════════════════════════════
// Sum type field propagation
// ═══════════════════════════════════════════════════════════════════════

/**
 * Propagate sum type fields to member nodes (mutates the nodes object).
 * Only needed at schema-build time for grammars that have sum type fields
 * (e.g., Expression.typeString).
 */
export function propagateSumTypeFields(
  nodes: Record<string, NodeDefShape>,
  sumTypes: Record<string, SumTypeDefShape>,
  sumTypeMembers: Readonly<Record<string, readonly string[]>>,
): void {
  for (const [stName, stDef] of Object.entries(sumTypes)) {
    if (!stDef.fields || Object.keys(stDef.fields).length === 0) continue;
    const members = sumTypeMembers[stName];
    if (!members) continue;
    for (const kind of members) {
      const node = nodes[kind];
      if (!node) continue;
      for (const [fname, fdesc] of Object.entries(stDef.fields)) {
        if (!(fname in node.fields)) {
          (node.fields as Record<string, FieldDescShape>)[fname] = fdesc;
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Grammar metadata factory
// ═══════════════════════════════════════════════════════════════════════

/** All computed runtime metadata for a grammar. */
export interface GrammarMetadata<N extends Record<string, NodeDefShape>> {
  /** NODES with sum type fields propagated to members (deep copy — original is not mutated). */
  nodes: N;
  /** Canonical field metadata for all node kinds. */
  fieldDefs: Readonly<Record<string, readonly FieldDef[]>>;
  /** Set of all node kind strings. */
  allKinds: ReadonlySet<string>;
  /** Sum type → member kinds. */
  sumTypeMembers: Readonly<Record<string, readonly string[]>>;
  /** Kind → sum type names (inverse of sumTypeMembers). */
  sumTypeMembership: Readonly<Record<string, readonly string[]>>;
}

/**
 * Create all runtime metadata for a grammar from its schema.
 * Deep-copies NODES, propagates sum type fields, computes all derived data.
 * Pure function — safe to call multiple times, each call returns independent state.
 */
export function createGrammarMetadata<N extends Record<string, NodeDefShape>>(
  nodesRaw: N,
  sumTypes: Record<string, SumTypeDefShape>,
): GrammarMetadata<N> {
  const nodes = JSON.parse(JSON.stringify(nodesRaw)) as N;
  const stMembers = computeSumTypeMembers(nodes as Record<string, NodeDefShape>, sumTypes);
  propagateSumTypeFields(nodes as Record<string, NodeDefShape>, sumTypes, stMembers);
  const fieldDefs = computeFieldDefs(nodes as Record<string, NodeDefShape>);
  const allKinds = computeAllKinds(nodes as Record<string, NodeDefShape>);
  const sumTypeMembership = computeKindMembership(stMembers);
  return { nodes, fieldDefs, allKinds, sumTypeMembers: stMembers, sumTypeMembership };
}
