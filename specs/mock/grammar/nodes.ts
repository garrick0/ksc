/**
 * Mock grammar — minimal AST for testing the two-functor pipeline.
 *
 * Defines 5 node kinds and 1 sum type. This is a minimal but complete
 * grammar that exercises all builder features (node, leaf, sumType,
 * child, list, optChild, prop).
 */

import type { GrammarBuilder } from '../../../grammar/builder.js';
import { child, list, optChild, prop } from '../../../grammar/builder.js';

export function defineGrammar(b: GrammarBuilder): void {
  // Sum types
  const Expr = b.sumType('MockExpression');
  const Stmt = b.sumType('MockStatement');

  // Root node
  b.node('MockProgram', [], {
    statements: list('MockStatement'),
  });

  // Statements
  b.node('MockExpressionStatement', [Stmt], {
    expression: child('MockExpression'),
  });

  b.node('MockLetStatement', [Stmt], {
    name: prop('string'),
    initializer: optChild('MockExpression'),
  });

  // Expressions
  b.leaf('MockLiteral', Expr);

  b.node('MockBinaryExpression', [Expr], {
    left: child('MockExpression'),
    right: child('MockExpression'),
    operator: prop('string'),
  });
}
