/**
 * Dashboard data types — re-exports from core-grammar and extraction adapter.
 *
 * Internal dashboard components import from this file (preserving short paths).
 * The canonical definitions live in @kindscript/core-grammar (SerializedNode)
 * and the extraction adapter (ASTDashboardData, ASTSchemaInfo).
 */

// SerializedNode/SerializedFieldEntry re-exported as ASTNode/ASTFieldEntry
// to avoid churn inside the dashboard SPA.
export type { SerializedNode as ASTNode, SerializedFieldEntry as ASTFieldEntry } from '@kindscript/core-grammar';
export type { ASTDashboardData, ASTSchemaInfo } from '../../../src/adapters/grammar/extraction/ts-ast/index.js';

export type FileViewerTab = 'source' | 'ast' | 'graph';
