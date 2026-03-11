/**
 * AST data extraction — transforms a KS tree into dashboard-friendly JSON.
 *
 * This is the bridge between the KindScript pipeline and the dashboard SPA.
 * It walks a KSTree and produces a serializable ASTDashboardData object.
 */

import { grammar } from '../../src/adapters/grammar/grammar/ts-ast/index.js';
import type { KSTree } from '../../src/adapters/grammar/ast-translator/ts-ast/convert.js';
import type { KSNode, KSIdentifier } from '../../src/adapters/grammar/grammar/ts-ast/index.js';
import type { ASTDashboardData, ASTNode, ASTSchemaInfo } from './app/types.js';

const { fieldDefs, sumTypeMembership } = grammar;

type IndexedNode = KSNode & { [key: string]: unknown };

// ── Implementation ──

function walkNode(node: KSNode): ASTNode {
  let name: string | undefined;
  const named = node as { name?: KSNode };
  if (named.name?.kind === 'Identifier') {
    name = (named.name as KSIdentifier).escapedText;
  }

  const full = node.text;
  const firstLine = full.split('\n')[0];
  const text = firstLine.length > 80 ? firstLine.slice(0, 77) + '...' : firstLine;

  const children: ASTNode[] = [];
  const fields: { name: string; indices: number[] }[] = [];
  const props: Record<string, string | number | boolean> = {};

  const defs = fieldDefs[node.kind];
  if (defs) {
    for (const def of defs) {
      if (def.tag === 'prop') {
        // Skip sourceText (redundant with file.source)
        if (def.name === 'sourceText') continue;
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
            children.push(walkNode(item as KSNode));
          }
        }
      } else {
        indices.push(children.length);
        children.push(walkNode(v as KSNode));
      }
      if (indices.length > 0) {
        fields.push({ name: def.name, indices });
      }
    }
  } else {
    // Leaf node: use generic children
    for (const child of (node.children ?? [])) {
      children.push(walkNode(child as KSNode));
    }
  }

  const result: ASTNode = { kind: node.kind, pos: node.pos, end: node.end, text, children };
  if (name) result.name = name;
  if (fields.length > 0) result.fields = fields;
  if (Object.keys(props).length > 0) result.props = props;
  return result;
}

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
      fieldDefs: fieldDefs as ASTSchemaInfo['fieldDefs'],
      sumTypes: sumTypeMembership as Record<string, readonly string[]>,
    },
    files,
  };
}
