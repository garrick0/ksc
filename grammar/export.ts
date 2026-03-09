/**
 * AST data export — extracts dashboard-friendly data from a KS tree.
 *
 * This is a grammar concern: it knows about KS node structure
 * and produces a simple, serializable representation for visualization.
 */

import type { KSTree } from '../generated/ts-ast/grammar/convert.js';
import type { KSNode, KSCompilationUnit, KSIdentifier } from '../generated/ts-ast/grammar/node-types.js';
import { getChildFields, fieldDefs, sumTypeMembership } from '../generated/ts-ast/grammar/schema.js';

// ── Types ──

export interface ASTFieldEntry {
  name: string;
  indices: number[];
}

export interface ASTNode {
  kind: string;
  name?: string;
  pos: number;
  end: number;
  text: string;
  children: ASTNode[];
  fields?: ASTFieldEntry[];
  props?: Record<string, string | number | boolean>;
}

export interface ASTSchemaInfo {
  fieldDefs: Record<string, readonly { name: string; tag: string; typeRef?: string }[]>;
  sumTypes: Record<string, readonly string[]>;
}

export interface ASTDashboardData {
  version: number;
  analysisDepth: 'parse' | 'bind' | 'check';
  schema: ASTSchemaInfo;
  files: Array<{
    fileName: string;
    lineCount: number;
    source: string;
    ast: ASTNode;
  }>;
}

// ── Helpers ──

function walkNode(node: KSNode): ASTNode {
  let name: string | undefined;
  const named = node as { name?: KSNode };
  if (named.name?.kind === 'Identifier') {
    name = (named.name as KSIdentifier).escapedText;
  }

  const full = node.text;
  const firstLine = full.split('\n')[0];
  const text = firstLine.length > 80 ? firstLine.slice(0, 77) + '...' : firstLine;

  const childFieldNames = getChildFields(node.kind);
  const children: ASTNode[] = [];
  const fields: ASTFieldEntry[] = [];
  const props: Record<string, string | number | boolean> = {};

  if (childFieldNames.length > 0) {
    // Complex node: iterate named fields
    const defs = fieldDefs[node.kind];
    if (defs) {
      for (const def of defs) {
        if (def.tag === 'prop') {
          // Skip sourceText (redundant with file.source)
          if (def.name === 'sourceText') continue;
          const val = (node as any)[def.name];
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
          props[def.name] = val;
          continue;
        }
        const v = (node as any)[def.name];
        if (v == null) continue;
        const indices: number[] = [];
        if (Array.isArray(v)) {
          for (const item of v) {
            if (item != null) {
              indices.push(children.length);
              children.push(walkNode(item));
            }
          }
        } else {
          indices.push(children.length);
          children.push(walkNode(v));
        }
        if (indices.length > 0) {
          fields.push({ name: def.name, indices });
        }
      }
    }
  } else {
    // Leaf node: use generic children
    for (const child of (node.children ?? [])) {
      children.push(walkNode(child));
    }
  }

  const result: ASTNode = { kind: node.kind, pos: node.pos, end: node.end, text, children };
  if (name) result.name = name;
  if (fields.length > 0) result.fields = fields;
  if (Object.keys(props).length > 0) result.props = props;
  return result;
}

// ── Main ──

/**
 * Extract dashboard-friendly AST data from a KS tree.
 * Walks each non-declaration compilation unit and produces
 * a serializable tree with field mappings and schema metadata.
 */
export function extractASTData(
  ksTree: KSTree,
  analysisDepth: 'parse' | 'bind' | 'check' = 'parse',
): ASTDashboardData {
  const files: ASTDashboardData['files'] = [];

  for (const cu of ksTree.root.compilationUnits) {
    if (cu.isDeclarationFile) continue;

    files.push({
      fileName: cu.fileName,
      lineCount: cu.lineStarts.length,
      source: cu.sourceText,
      ast: walkNode(cu as KSNode),
    });
  }

  return {
    version: 2,
    analysisDepth,
    schema: {
      fieldDefs: fieldDefs as Record<string, readonly { name: string; tag: string; typeRef?: string }[]>,
      sumTypes: sumTypeMembership as Record<string, readonly string[]>,
    },
    files,
  };
}
