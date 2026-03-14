/**
 * Extraction adapter types — TS AST extraction output shapes.
 *
 * These types define the serialized data format produced by extractASTData.
 * They use SerializedNode from core-grammar as the node representation.
 */

import type { SerializedNode } from '@ksc/grammar';

export interface ASTSchemaInfo {
  fieldDefs: Record<string, readonly ({ name: string; tag: 'child' | 'optChild' | 'list'; typeRef?: string } | { name: string; tag: 'prop'; propType: string; default?: unknown })[]>;
  sumTypes: Record<string, readonly string[]>;
}

export interface ASTDashboardData {
  version: number;
  analysisDepth?: 'parse' | 'bind' | 'check';
  schema?: ASTSchemaInfo;
  files: Array<{
    fileName: string;
    lineCount: number;
    source: string;
    ast: SerializedNode;
  }>;
}
