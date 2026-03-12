/**
 * Generic tree serialization — walks any grammar tree using fieldDefs
 * and produces a presentation-friendly serialized node tree.
 *
 * Unlike nodeToJSON/treeToJSON (lossless round-trip format), this produces
 * a compact format designed for visualization: truncated text previews,
 * field-index mappings, and scalar-only props.
 *
 * Grammar-agnostic — no knowledge of specific node kinds or grammars.
 * Language-specific concerns (e.g., name extraction) are injected via options.
 */

import type { ASTNode, FieldDef } from './ports.js';

/** ASTNode with index signature for dynamic field access by FieldDef name. */
type IndexedNode = ASTNode & { readonly [key: string]: unknown };

// ═══════════════════════════════════════════════════════════════════════
// Serialized node types — output of serializeNode
// ═══════════════════════════════════════════════════════════════════════

/** A field entry mapping a field name to child indices in the serialized node's children array. */
export interface SerializedFieldEntry {
  name: string;
  indices: number[];
}

/** A presentation-friendly serialized AST node. */
export interface SerializedNode {
  kind: string;
  name?: string;
  pos: number;
  end: number;
  text: string;
  children: SerializedNode[];
  fields?: SerializedFieldEntry[];
  props?: Record<string, string | number | boolean>;
}

// ═══════════════════════════════════════════════════════════════════════
// Options
// ═══════════════════════════════════════════════════════════════════════

export interface SerializeNodeOptions {
  /** Extract a display name from a node. Return undefined to skip. */
  getName?: (node: ASTNode) => string | undefined;
  /** Maximum length for the first-line text preview. Default: 80. */
  maxTextLength?: number;
  /** Property names to skip during serialization. */
  skipProps?: ReadonlySet<string>;
}

// ═══════════════════════════════════════════════════════════════════════
// Implementation
// ═══════════════════════════════════════════════════════════════════════

/**
 * Serialize a single AST node into a presentation-friendly format.
 *
 * Walks the node's fields using the provided fieldDefs to classify
 * children (recursed into) vs props (collected as scalars).
 */
export function serializeNode(
  node: ASTNode,
  fieldDefs: Readonly<Record<string, readonly FieldDef[]>>,
  options?: SerializeNodeOptions,
): SerializedNode {
  const getName = options?.getName;
  const maxLen = options?.maxTextLength ?? 80;
  const skipProps = options?.skipProps;

  const name = getName?.(node);

  const full = node.text;
  const firstLine = full.split('\n')[0];
  const text = firstLine.length > maxLen ? firstLine.slice(0, maxLen - 3) + '...' : firstLine;

  const children: SerializedNode[] = [];
  const fields: SerializedFieldEntry[] = [];
  const props: Record<string, string | number | boolean> = {};

  const defs = fieldDefs[node.kind];
  if (defs) {
    for (const def of defs) {
      if (def.tag === 'prop') {
        if (skipProps?.has(def.name)) continue;
        const val = (node as IndexedNode)[def.name];
        if (val === undefined || val === null) continue;
        // Include all booleans (even false) for flag visibility
        if (typeof val === 'boolean') {
          props[def.name] = val;
          continue;
        }
        // Convert arrays to length for display
        if (Array.isArray(val)) {
          props[def.name] = val.length;
          continue;
        }
        // Skip empty strings
        if (val === '') continue;
        props[def.name] = val as string | number;
        continue;
      }
      const v = (node as IndexedNode)[def.name];
      if (v == null) continue;
      const indices: number[] = [];
      if (Array.isArray(v)) {
        for (const item of v) {
          if (item != null) {
            indices.push(children.length);
            children.push(serializeNode(item as ASTNode, fieldDefs, options));
          }
        }
      } else {
        indices.push(children.length);
        children.push(serializeNode(v as ASTNode, fieldDefs, options));
      }
      if (indices.length > 0) {
        fields.push({ name: def.name, indices });
      }
    }
  } else {
    // Leaf node: use generic children
    for (const child of (node.children ?? [])) {
      children.push(serializeNode(child, fieldDefs, options));
    }
  }

  const result: SerializedNode = { kind: node.kind, pos: node.pos, end: node.end, text, children };
  if (name) result.name = name;
  if (fields.length > 0) result.fields = fields;
  if (Object.keys(props).length > 0) result.props = props;
  return result;
}
