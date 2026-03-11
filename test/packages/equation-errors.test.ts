/**
 * P3-21: Evaluator error path tests.
 *
 * Tests that the evaluator engine produces useful errors for:
 *   - Unknown attribute access
 *   - Cycle detection (self-loop and mutual recursion)
 *   - Equation functions that throw
 */
import { describe, it, expect } from 'vitest';
import { createEvaluator } from '@kindscript/core-evaluator';
import type { DispatchConfig, EvaluatorConfig } from '@kindscript/core-evaluator';
import type { Grammar } from '@kindscript/core-grammar';

// ── Minimal test infrastructure ───────────────────────────────────────

function makeLeaf(kind = 'Leaf') {
  return { kind, children: [], pos: 0, end: 1 };
}

function makeTree() {
  const child = makeLeaf();
  const root = { kind: 'Root', children: [child], pos: 0, end: 2 };
  return root;
}

const testGrammar: Grammar = {
  fieldDefs: {
    Root: [{ name: 'children', tag: 'list' }],
    Leaf: [],
  },
  allKinds: new Set(['Root', 'Leaf']),
  fileContainerKind: 'Root',
  fileNameField: 'fileName',
  sumTypeMembers: {},
  sumTypeMembership: {},
};

function makeConfig(dispatch: DispatchConfig): EvaluatorConfig {
  return {
    dispatch,
    grammar: testGrammar,
    projections: {},
  };
}

// ── Unknown attribute ─────────────────────────────────────────────────

describe('evaluator errors — unknown attribute', () => {
  it('throws with attribute name in message', () => {
    const evaluator = createEvaluator(makeConfig({}));
    const tree = evaluator.buildTree(makeTree());
    expect(() => tree.attr('nonexistent')).toThrow("Unknown attribute 'nonexistent'");
  });

  it('throws with node kind in message', () => {
    const evaluator = createEvaluator(makeConfig({}));
    const tree = evaluator.buildTree(makeTree());
    expect(() => tree.attr('missing')).toThrow('Root');
  });

  it('throws for unknown attr on child node', () => {
    const evaluator = createEvaluator(makeConfig({}));
    const tree = evaluator.buildTree(makeTree());
    expect(() => tree.children[0].attr('bogus')).toThrow("Unknown attribute 'bogus'");
    expect(() => tree.children[0].attr('bogus')).toThrow('Leaf');
  });
});

// ── Cycle detection ───────────────────────────────────────────────────

describe('evaluator errors — cycle detection', () => {
  it('detects self-referencing syn attribute', () => {
    const dispatch: DispatchConfig = {
      selfLoop: {
        direction: 'syn',
        compute: (ctx) => ctx.attr('selfLoop'),
      },
    };
    const evaluator = createEvaluator(makeConfig(dispatch));
    const tree = evaluator.buildTree(makeTree());
    expect(() => tree.attr('selfLoop')).toThrow('Circular attribute access');
    expect(() => tree.attr('selfLoop')).toThrow("'selfLoop'");
  });

  it('detects mutual recursion between two attributes', () => {
    const dispatch: DispatchConfig = {
      attrA: {
        direction: 'syn',
        compute: (ctx) => ctx.attr('attrB'),
      },
      attrB: {
        direction: 'syn',
        compute: (ctx) => ctx.attr('attrA'),
      },
    };
    const evaluator = createEvaluator(makeConfig(dispatch));
    const tree = evaluator.buildTree(makeTree());
    expect(() => tree.attr('attrA')).toThrow('Circular attribute access');
  });

  it('includes parameter in cycle detection message for parameterized attrs', () => {
    const dispatch: DispatchConfig = {
      paramLoop: {
        direction: 'syn',
        compute: (ctx, key) => ctx.attr('paramLoop', key),
      },
    };
    const evaluator = createEvaluator(makeConfig(dispatch));
    const tree = evaluator.buildTree(makeTree());
    expect(() => tree.attr('paramLoop', 'myKey')).toThrow('Circular attribute access');
    expect(() => tree.attr('paramLoop', 'myKey')).toThrow('paramLoop(myKey)');
  });

  it('does not false-positive on same attr with different params', () => {
    let callCount = 0;
    const dispatch: DispatchConfig = {
      lookup: {
        direction: 'syn',
        compute: (_ctx, key) => { callCount++; return `val:${key}`; },
      },
    };
    const evaluator = createEvaluator(makeConfig(dispatch));
    const tree = evaluator.buildTree(makeTree());
    // Different params should not trigger cycle detection
    expect(tree.attr('lookup', 'a')).toBe('val:a');
    expect(tree.attr('lookup', 'b')).toBe('val:b');
    expect(callCount).toBe(2);
  });
});

// ── Equation throws ───────────────────────────────────────────────────

describe('evaluator errors — equation throws', () => {
  it('propagates error from syn equation', () => {
    const dispatch: DispatchConfig = {
      broken: {
        direction: 'syn',
        compute: () => { throw new Error('equation failed'); },
      },
    };
    const evaluator = createEvaluator(makeConfig(dispatch));
    const tree = evaluator.buildTree(makeTree());
    expect(() => tree.attr('broken')).toThrow('equation failed');
  });

  it('propagates error from inh root equation', () => {
    const dispatch: DispatchConfig = {
      badRoot: {
        direction: 'inh',
        computeRoot: () => { throw new TypeError('root computation error'); },
      },
    };
    const evaluator = createEvaluator(makeConfig(dispatch));
    const tree = evaluator.buildTree(makeTree());
    expect(() => tree.attr('badRoot')).toThrow('root computation error');
  });

  it('propagates error from inh parent equation', () => {
    const dispatch: DispatchConfig = {
      badParent: {
        direction: 'inh',
        computeRoot: () => 'ok',
        computeParent: () => { throw new RangeError('parent boom'); },
      },
    };
    const evaluator = createEvaluator(makeConfig(dispatch));
    const tree = evaluator.buildTree(makeTree());
    // Root succeeds (uses computeRoot)
    expect(tree.attr('badParent')).toBe('ok');
    // Child fails (uses computeParent)
    expect(() => tree.children[0].attr('badParent')).toThrow('parent boom');
  });

  it('clears cycle detection after error (allows retry)', () => {
    let shouldThrow = true;
    const dispatch: DispatchConfig = {
      flaky: {
        direction: 'syn',
        compute: () => {
          if (shouldThrow) throw new Error('transient');
          return 'recovered';
        },
      },
    };
    const evaluator = createEvaluator(makeConfig(dispatch));
    const tree = evaluator.buildTree(makeTree());

    // First call throws
    expect(() => tree.attr('flaky')).toThrow('transient');

    // After the error, cycle detection should be cleared (finally block),
    // so calling again with shouldThrow=false should not throw a cycle error
    shouldThrow = false;
    // Note: because the first call threw before caching, this will re-compute
    expect(tree.attr('flaky')).toBe('recovered');
  });
});
