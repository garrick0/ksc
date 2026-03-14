/**
 * Mock grammar — minimal AST for testing the two-functor pipeline.
 *
 * Defines 5 node kinds and 2 sum types. This is a minimal but complete
 * grammar that exercises all definition features (node, leaf, sumType,
 * child, list, optChild, prop).
 */

import type { NodeDefShape, SumTypeDefShape } from '@ksc/grammar';

// ── Sum types ────────────────────────────────────────────────────────

export const SUM_TYPES = {
  MockExpression: {},
  MockStatement: {},
} satisfies Record<string, SumTypeDefShape>;

// ── Nodes ────────────────────────────────────────────────────────────

export const NODES = {
  // Root node
  MockProgram: {
    memberOf: [],
    fields: { statements: { tag: 'list', typeRef: 'MockStatement' } as const },
  },

  // Statements
  MockExpressionStatement: {
    memberOf: ['MockStatement'],
    fields: { expression: { tag: 'child', typeRef: 'MockExpression' } as const },
  },
  MockLetStatement: {
    memberOf: ['MockStatement'],
    fields: {
      name: { tag: 'prop', propType: 'string' } as const,
      initializer: { tag: 'optChild', typeRef: 'MockExpression' } as const,
    },
  },

  // Expressions
  MockLiteral: {
    memberOf: ['MockExpression'],
    fields: {},
  },
  MockBinaryExpression: {
    memberOf: ['MockExpression'],
    fields: {
      left: { tag: 'child', typeRef: 'MockExpression' } as const,
      right: { tag: 'child', typeRef: 'MockExpression' } as const,
      operator: { tag: 'prop', propType: 'string' } as const,
    },
  },
} satisfies Record<string, NodeDefShape>;

/** Union of all mock grammar node kind strings (derived at the type level). */
export type MockKind = keyof typeof NODES;
