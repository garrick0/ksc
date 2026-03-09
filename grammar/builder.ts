/**
 * Schema builder — declares AST node definitions and sum types.
 *
 * Provides a scoped builder pattern: create a GrammarBuilder instance,
 * pass it to a grammar definition function, then call .build() to get
 * the final registries.
 *
 * Field descriptor helpers (child, optChild, list, prop) are standalone
 * functions — they don't depend on builder state.
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

// ── Scoped builder ──────────────────────────────────────────────────

export interface GrammarBuilder {
  /** Declare a sum type. Returns the name for use in memberOf arrays. */
  sumType(name: string): string;

  /** Declare that sumTypeName includes all members of another sum type. */
  sumTypeIncludes(sumTypeName: string, ...includedSumTypes: string[]): void;

  /** Resolve all sum type includes. Call once after all nodes are registered. */
  resolveIncludes(): void;

  /** Register a node kind with fields. */
  node(kind: string, memberOf: string[], fields: Record<string, FieldDesc>): string;

  /** Register a leaf node kind (no fields). */
  leaf(kind: string, ...memberOf: string[]): string;

  /** Add a field to all members of a sum type. Call after all nodes are registered. */
  addFieldToSumTypeMembers(sumTypeName: string, fieldName: string, field: FieldDesc): void;

  /** Add a field to specific node kinds. */
  addFieldToKinds(kinds: string[], fieldName: string, field: FieldDesc): void;

  /** Finalize and return the registries. */
  build(): { nodes: Map<string, NodeEntry>; sumTypes: Map<string, SumTypeEntry> };
}

export function createGrammarBuilder(): GrammarBuilder {
  const nodeRegistry = new Map<string, NodeEntry>();
  const sumTypeRegistry = new Map<string, SumTypeEntry>();

  function addToSumType(sumTypeName: string, kind: string): void {
    const st = sumTypeRegistry.get(sumTypeName);
    if (st) {
      if (!st.members.includes(kind)) {
        st.members.push(kind);
      }
    }
  }

  return {
    sumType(name: string): string {
      if (!sumTypeRegistry.has(name)) {
        sumTypeRegistry.set(name, { name, members: [], includes: [] });
      }
      return name;
    },

    sumTypeIncludes(sumTypeName: string, ...includedSumTypes: string[]): void {
      const st = sumTypeRegistry.get(sumTypeName);
      if (!st) throw new Error(`Unknown sum type: '${sumTypeName}'`);
      st.includes.push(...includedSumTypes);
    },

    resolveIncludes(): void {
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
    },

    node(kind: string, memberOf: string[], fields: Record<string, FieldDesc>): string {
      if (nodeRegistry.has(kind)) {
        throw new Error(`Duplicate node kind: '${kind}'`);
      }
      nodeRegistry.set(kind, { kind, fields, memberOf });
      for (const st of memberOf) {
        addToSumType(st, kind);
      }
      return kind;
    },

    leaf(kind: string, ...memberOf: string[]): string {
      if (nodeRegistry.has(kind)) {
        throw new Error(`Duplicate leaf kind: '${kind}'`);
      }
      nodeRegistry.set(kind, { kind, fields: {}, memberOf });
      for (const st of memberOf) {
        addToSumType(st, kind);
      }
      return kind;
    },

    addFieldToSumTypeMembers(sumTypeName: string, fieldName: string, field: FieldDesc): void {
      const st = sumTypeRegistry.get(sumTypeName);
      if (!st) throw new Error(`Unknown sum type: '${sumTypeName}'`);
      for (const memberKind of st.members) {
        const entry = nodeRegistry.get(memberKind);
        if (!entry) continue;
        if (!(fieldName in entry.fields)) {
          entry.fields[fieldName] = field;
        }
      }
    },

    addFieldToKinds(kinds: string[], fieldName: string, field: FieldDesc): void {
      for (const kind of kinds) {
        const entry = nodeRegistry.get(kind);
        if (!entry) throw new Error(`Unknown node kind: '${kind}'`);
        if (!(fieldName in entry.fields)) {
          entry.fields[fieldName] = field;
        }
      }
    },

    build() {
      return { nodes: nodeRegistry, sumTypes: sumTypeRegistry };
    },
  };
}
