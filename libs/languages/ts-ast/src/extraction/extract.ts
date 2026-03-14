/**
 * Adapter: TS AST extraction — serialize a KSTree into dashboard-friendly JSON.
 *
 * Uses the generic serializeNode walker from core-grammar for field/prop
 * classification, and adds TS-specific logic:
 *   - Declaration file filtering (cu.isDeclarationFile)
 *   - Identifier name extraction (KSIdentifier.escapedText)
 *   - CompilationUnit shape (fileName, lineStarts, sourceText)
 */

import { serializeNode } from '@ksc/grammar';
import type { ASTNode } from '@ksc/grammar';
import { fieldDefs, sumTypeMembership } from '../grammar/index.js';
import type { KSTree } from '../translator/convert.js';
import type { KSNode, KSIdentifier } from '../grammar/index.js';
import type { ASTDashboardData, ASTSchemaInfo } from './types.js';

// ── TS-specific name extraction ─────────────────────────────────────

function getTSNodeName(node: ASTNode): string | undefined {
  const named = node as { name?: ASTNode };
  if (named.name?.kind === 'Identifier') {
    return (named.name as KSIdentifier).escapedText;
  }
  return undefined;
}

const SKIP_PROPS: ReadonlySet<string> = new Set(['sourceText']);

// ── Public API ──────────────────────────────────────────────────────

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
      ast: serializeNode(cu as KSNode, fieldDefs, {
        getName: getTSNodeName,
        skipProps: SKIP_PROPS,
      }),
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
