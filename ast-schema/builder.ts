/**
 * Schema builder — used by schema.ts to declare AST node definitions.
 *
 * This module is evaluated at codegen time. The builder functions construct
 * a registry of node definitions and sum types that the codegen script
 * iterates to produce generated output.
 */

// ── Field descriptors ────────────────────────────────────────────────

export interface ChildField {
  tag: 'child';
  /** Sum type or node ref name, e.g. 'Expression', 'Identifier'. Undefined = KSNode. */
  typeRef: string | undefined;
}

export interface OptChildField {
  tag: 'optChild';
  typeRef: string | undefined;
}

export interface ListField {
  tag: 'list';
  typeRef: string | undefined;
}

export interface PropField {
  tag: 'prop';
  propType: string; // e.g. 'string', 'boolean', 'number', 'readonly number[]'
}

export type FieldDesc = ChildField | OptChildField | ListField | PropField;

export function child(typeRef?: string): ChildField {
  return { tag: 'child', typeRef };
}

export function optChild(typeRef?: string): OptChildField {
  return { tag: 'optChild', typeRef };
}

export function list(typeRef?: string): ListField {
  return { tag: 'list', typeRef };
}

export function prop(propType: string): PropField {
  return { tag: 'prop', propType };
}

// ── Node definition ──────────────────────────────────────────────────

export interface NodeEntry {
  kind: string;
  fields: Record<string, FieldDesc>;
  /** Sum type names this node belongs to */
  memberOf: string[];
}

export interface SumTypeEntry {
  name: string;
  members: string[]; // kind strings
  includes: string[]; // other sum type names whose members are included
}

// ── Global registry ──────────────────────────────────────────────────

const nodeRegistry = new Map<string, NodeEntry>();
const sumTypeRegistry = new Map<string, SumTypeEntry>();

export function getNodeRegistry(): ReadonlyMap<string, NodeEntry> {
  return nodeRegistry;
}

export function getSumTypeRegistry(): ReadonlyMap<string, SumTypeEntry> {
  return sumTypeRegistry;
}

// ── Sum type declaration ─────────────────────────────────────────────

export function sumType(name: string): string {
  if (!sumTypeRegistry.has(name)) {
    sumTypeRegistry.set(name, { name, members: [], includes: [] });
  }
  return name;
}

/**
 * Declare that sumTypeName includes all members of includedSumType.
 * Resolved at codegen time.
 */
export function sumTypeIncludes(sumTypeName: string, ...includedSumTypes: string[]): void {
  const st = sumTypeRegistry.get(sumTypeName);
  if (!st) throw new Error(`Unknown sum type: '${sumTypeName}'`);
  st.includes.push(...includedSumTypes);
}

/**
 * Resolve all sum type includes, expanding transitive memberships.
 * Call once after all nodes are registered.
 */
export function resolveIncludes(): void {
  for (const [, st] of sumTypeRegistry) {
    if (st.includes.length === 0) continue;
    for (const incName of st.includes) {
      const incSt = sumTypeRegistry.get(incName);
      if (!incSt) throw new Error(`Sum type '${st.name}' includes unknown '${incName}'`);
      for (const member of incSt.members) {
        if (!st.members.includes(member)) {
          st.members.push(member);
        }
      }
    }
  }
}

function addToSumType(sumTypeName: string, kind: string): void {
  const st = sumTypeRegistry.get(sumTypeName);
  if (st) {
    if (!st.members.includes(kind)) {
      st.members.push(kind);
    }
  }
}

// ── Node registration ────────────────────────────────────────────────

export function node(
  kind: string,
  memberOf: string[],
  fields: Record<string, FieldDesc>,
): string {
  if (nodeRegistry.has(kind)) {
    throw new Error(`Duplicate node kind: '${kind}'`);
  }
  nodeRegistry.set(kind, { kind, fields, memberOf });
  for (const st of memberOf) {
    addToSumType(st, kind);
  }
  return kind;
}

export function leaf(kind: string, ...memberOf: string[]): string {
  if (nodeRegistry.has(kind)) {
    throw new Error(`Duplicate leaf kind: '${kind}'`);
  }
  nodeRegistry.set(kind, { kind, fields: {}, memberOf });
  for (const st of memberOf) {
    addToSumType(st, kind);
  }
  return kind;
}
