/**
 * Grammar-level base types — shared by all grammar adapters.
 *
 * Types defined here:
 *   - KSCommentRange — comment range metadata
 *   - KSNodeBase     — base interface for all KS nodes (extends ASTNode)
 */

import type { ASTNode } from './ports.js';

export interface KSCommentRange {
  pos: number;
  end: number;
  kind: 'SingleLine' | 'MultiLine';
  hasTrailingNewLine?: boolean;
}

/** Fields shared by every KS node. Extends ASTNode with grammar-specific metadata. */
export interface KSNodeBase extends ASTNode {
  children: (ASTNode & { kind: string })[];
  leadingComments?: KSCommentRange[];
  trailingComments?: KSCommentRange[];
  /** Index signature — nodes have arbitrary fields defined by the grammar schema. */
  readonly [key: string]: unknown;
}
