/**
 * Grammar coverage test — verifies our grammar covers all TypeScript SyntaxKinds.
 *
 * Catches grammar drift when TypeScript adds new AST node kinds.
 * This is the only check that detects "TS 5.x added FooExpression and we don't have it."
 */
import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { NODES } from '@ksc/language-ts-ast/grammar/nodes.js';

describe('grammar coverage vs TypeScript SyntaxKind', () => {
  const ourKinds = new Set(Object.keys(NODES));
  const kscOnlyNodes = new Set(['Program', 'CompilationUnit']);

  // Collect all non-alias SyntaxKind names
  const tsSyntaxKindNames = new Set<string>();
  for (const key of Object.keys(ts.SyntaxKind)) {
    if (isNaN(Number(key))) {
      if (key.startsWith('First') || key.startsWith('Last') || key === 'Count') continue;
      tsSyntaxKindNames.add(key);
    }
  }

  it('covers all TypeScript SyntaxKinds', () => {
    const missing: string[] = [];
    for (const tsKind of tsSyntaxKindNames) {
      if (!ourKinds.has(tsKind) && !kscOnlyNodes.has(tsKind)) {
        missing.push(tsKind);
      }
    }
    expect(missing, `Missing SyntaxKinds: ${missing.join(', ')}`).toEqual([]);
  });

  it('does not have phantom kinds absent from TypeScript', () => {
    const phantom: string[] = [];
    for (const ourKind of ourKinds) {
      if (!tsSyntaxKindNames.has(ourKind) && !kscOnlyNodes.has(ourKind)) {
        phantom.push(ourKind);
      }
    }
    expect(phantom, `Phantom kinds: ${phantom.join(', ')}`).toEqual([]);
  });
});
