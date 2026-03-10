/**
 * Unit tests for the hand-written AG evaluator engine (evaluator/engine.ts).
 *
 * Tests AG patterns (caching, cycle detection, copy-down, collection fold,
 * structural queries) using minimal inline dispatch configs — no real specs.
 */
import { describe, it, expect } from 'vitest';
import { createEvaluator, validateDispatch } from '../../evaluator/engine.js';
import type { DispatchConfig, EvaluatorConfig } from '../../evaluator/types.js';
import type { FieldDef, Grammar } from '../../grammar/index.js';

// ── Minimal test AST ─────────────────────────────────────────────────

/** A simple AST: Root → [A, B], A → [C] */
function makeTestTree() {
  const C = { kind: 'Leaf', children: [], pos: 0, end: 1 };
  const A = { kind: 'Inner', children: [C], pos: 0, end: 2 };
  const B = { kind: 'Leaf', children: [], pos: 2, end: 3 };
  const root = { kind: 'Root', children: [A, B], pos: 0, end: 3 };
  return { root, A, B, C };
}

const testGrammar: Grammar = {
  fieldDefs: {
    Root: [{ name: 'children', tag: 'list' }],
    Inner: [{ name: 'children', tag: 'list' }],
    Leaf: [],
  },
  allKinds: new Set(['Root', 'Inner', 'Leaf']),
  rootKind: 'Root',
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

// ── Synthesized attributes ───────────────────────────────────────────

describe('evaluator — syn attributes', () => {
  it('computes a syn attribute from dispatch', () => {
    const dispatch: DispatchConfig = {
      label: {
        direction: 'syn',
        compute: (ctx) => `node:${ctx.node.kind}`,
      },
    };
    const evaluator = createEvaluator(makeConfig(dispatch));
    const tree = evaluator.buildTree(makeTestTree().root);
    expect(tree.attr('label')).toBe('node:Root');
    expect(tree.children[0].attr('label')).toBe('node:Inner');
  });

  it('throws for unknown attribute', () => {
    const evaluator = createEvaluator(makeConfig({}));
    const tree = evaluator.buildTree(makeTestTree().root);
    expect(() => tree.attr('nonexistent')).toThrow('Unknown attribute');
  });
});

// ── Caching ──────────────────────────────────────────────────────────

describe('evaluator — caching', () => {
  it('caches non-parameterized attributes (compute called once)', () => {
    let callCount = 0;
    const dispatch: DispatchConfig = {
      counted: {
        direction: 'syn',
        compute: (ctx) => { callCount++; return 42; },
      },
    };
    const evaluator = createEvaluator(makeConfig(dispatch));
    const tree = evaluator.buildTree(makeTestTree().root);

    expect(tree.attr('counted')).toBe(42);
    expect(tree.attr('counted')).toBe(42);
    expect(callCount).toBe(1);
  });

  it('caches parameterized attributes per-param', () => {
    let callCount = 0;
    const dispatch: DispatchConfig = {
      lookup: {
        direction: 'syn',
        compute: (ctx, key) => { callCount++; return `${key}!`; },
      },
    };
    const evaluator = createEvaluator(makeConfig(dispatch));
    const tree = evaluator.buildTree(makeTestTree().root);

    expect(tree.attr('lookup', 'a')).toBe('a!');
    expect(tree.attr('lookup', 'b')).toBe('b!');
    expect(tree.attr('lookup', 'a')).toBe('a!');  // cached
    expect(callCount).toBe(2);  // only 'a' and 'b', not 3
  });
});

// ── Cycle detection ──────────────────────────────────────────────────

describe('evaluator — cycle detection', () => {
  it('throws on circular attribute access', () => {
    const dispatch: DispatchConfig = {
      loop: {
        direction: 'syn',
        compute: (ctx) => ctx.attr('loop'),  // self-loop
      },
    };
    const evaluator = createEvaluator(makeConfig(dispatch));
    const tree = evaluator.buildTree(makeTestTree().root);
    expect(() => tree.attr('loop')).toThrow('Circular attribute access');
  });

  it('throws on parameterized circular access', () => {
    const dispatch: DispatchConfig = {
      ploop: {
        direction: 'syn',
        compute: (ctx, key) => ctx.attr('ploop', key),
      },
    };
    const evaluator = createEvaluator(makeConfig(dispatch));
    const tree = evaluator.buildTree(makeTestTree().root);
    expect(() => tree.attr('ploop', 'x')).toThrow('Circular attribute access');
  });
});

// ── Inherited attributes ─────────────────────────────────────────────

describe('evaluator — inh attributes', () => {
  it('uses root value at the root node', () => {
    const dispatch: DispatchConfig = {
      depth: {
        direction: 'inh',
        computeRoot: () => 0,
      },
    };
    const evaluator = createEvaluator(makeConfig(dispatch));
    const tree = evaluator.buildTree(makeTestTree().root);
    expect(tree.attr('depth')).toBe(0);
  });

  it('copies down when no parent override', () => {
    const dispatch: DispatchConfig = {
      env: {
        direction: 'inh',
        computeRoot: () => 'root-env',
      },
    };
    const evaluator = createEvaluator(makeConfig(dispatch));
    const tree = evaluator.buildTree(makeTestTree().root);
    // Children should copy-down from root
    expect(tree.children[0].attr('env')).toBe('root-env');
    // Grandchildren too
    expect(tree.children[0].children[0].attr('env')).toBe('root-env');
  });

  it('uses parent override when computeParent returns non-undefined', () => {
    const dispatch: DispatchConfig = {
      depth: {
        direction: 'inh',
        computeRoot: () => 0,
        computeParent: (ctx) => ctx.parent!.attr('depth') + 1,
      },
    };
    const evaluator = createEvaluator(makeConfig(dispatch));
    const tree = evaluator.buildTree(makeTestTree().root);
    expect(tree.attr('depth')).toBe(0);
    expect(tree.children[0].attr('depth')).toBe(1);
    expect(tree.children[0].children[0].attr('depth')).toBe(2);
  });

  it('copies down when computeParent returns undefined', () => {
    const dispatch: DispatchConfig = {
      flag: {
        direction: 'inh',
        computeRoot: () => 'initial',
        computeParent: (ctx) => {
          // Only override for Inner nodes
          if (ctx.parent!.node.kind === 'Inner') return 'overridden';
          return undefined;  // copy-down
        },
      },
    };
    const evaluator = createEvaluator(makeConfig(dispatch));
    const tree = evaluator.buildTree(makeTestTree().root);
    expect(tree.attr('flag')).toBe('initial');
    // Root's children: copy-down (Root is parent, not Inner)
    expect(tree.children[0].attr('flag')).toBe('initial');
    // Inner's child C: overridden (Inner is parent)
    expect(tree.children[0].children[0].attr('flag')).toBe('overridden');
  });
});

// ── Collection attributes ────────────────────────────────────────────

describe('evaluator — collection attributes', () => {
  it('folds over children with init and combine', () => {
    const dispatch: DispatchConfig = {
      nodeCount: {
        direction: 'collection',
        init: 1,
        combine: (acc: number, child: number) => acc + child,
      },
    };
    const evaluator = createEvaluator(makeConfig(dispatch));
    const tree = evaluator.buildTree(makeTestTree().root);

    // Leaves: init=1, no children → 1
    expect(tree.children[1].attr('nodeCount')).toBe(1);  // B (leaf)
    expect(tree.children[0].children[0].attr('nodeCount')).toBe(1);  // C (leaf)
    // Inner: 1 + C(1) = 2
    expect(tree.children[0].attr('nodeCount')).toBe(2);
    // Root: 1 + A(2) + B(1) = 4
    expect(tree.attr('nodeCount')).toBe(4);
  });
});

// ── Structural queries ───────────────────────────────────────────────

describe('evaluator — structural queries', () => {
  it('parentIs checks kind and field', () => {
    const evaluator = createEvaluator(makeConfig({}));
    const tree = evaluator.buildTree(makeTestTree().root);

    expect(tree.children[0].parentIs('Root')).toBe(true);
    expect(tree.children[0].parentIs('Leaf')).toBe(false);
    expect(tree.children[0].parentIs('Root', 'children')).toBe(true);
    expect(tree.children[0].parentIs('Root', 'other')).toBe(false);
  });

  it('root has no parent', () => {
    const evaluator = createEvaluator(makeConfig({}));
    const tree = evaluator.buildTree(makeTestTree().root);
    expect(tree.isRoot).toBe(true);
    expect(tree.parent).toBeUndefined();
    expect(tree.parentIs('anything')).toBe(false);
  });

  it('findFileName walks to rootKind node', () => {
    const rootWithFile = {
      kind: 'Root',
      fileName: 'test.ts',
      children: [{ kind: 'Leaf', children: [], pos: 0, end: 1 }],
      pos: 0,
      end: 1,
    };
    const evaluator = createEvaluator(makeConfig({}));
    const tree = evaluator.buildTree(rootWithFile);
    expect(tree.children[0].findFileName()).toBe('test.ts');
  });
});

// ── Tree building ────────────────────────────────────────────────────

describe('evaluator — tree building', () => {
  it('builds correct parent-child relationships', () => {
    const evaluator = createEvaluator(makeConfig({}));
    const tree = evaluator.buildTree(makeTestTree().root);

    expect(tree.children.length).toBe(2);
    expect(tree.children[0].parent).toBe(tree);
    expect(tree.children[1].parent).toBe(tree);
    expect(tree.children[0].children[0].parent).toBe(tree.children[0]);
  });

  it('sets fieldName on children', () => {
    const evaluator = createEvaluator(makeConfig({}));
    const tree = evaluator.buildTree(makeTestTree().root);
    expect(tree.children[0].fieldName).toBe('children');
  });

  it('preserves node references', () => {
    const { root, A, C } = makeTestTree();
    const evaluator = createEvaluator(makeConfig({}));
    const tree = evaluator.buildTree(root);
    expect(tree.node).toBe(root);
    expect(tree.children[0].node).toBe(A);
    expect(tree.children[0].children[0].node).toBe(C);
  });
});

// ── Evaluate + projections ───────────────────────────────────────────

describe('evaluator — evaluate with projections', () => {
  it('runs projections and returns results', () => {
    const dispatch: DispatchConfig = {
      nodeCount: {
        direction: 'collection',
        init: 1,
        combine: (acc: number, child: number) => acc + child,
      },
    };
    const config: EvaluatorConfig = {
      dispatch,
      grammar: testGrammar,
      projections: {
        totalNodes: (root) => root.attr('nodeCount'),
      },
    };
    const evaluator = createEvaluator(config);
    const result = evaluator.evaluate(makeTestTree().root);
    expect(result.totalNodes).toBe(4);
  });

  it('calls setup before evaluation', () => {
    let setupCalled = false;
    const config: EvaluatorConfig = {
      dispatch: {},
      grammar: testGrammar,
      projections: {},
      setup: () => { setupCalled = true; },
    };
    const evaluator = createEvaluator(config);
    evaluator.evaluate(makeTestTree().root);
    expect(setupCalled).toBe(true);
  });
});

// ── Dispatch validation ───────────────────────────────────────────────

describe('evaluator — validateDispatch', () => {
  it('passes when dispatch matches attr names', () => {
    const dispatch: DispatchConfig = {
      a: { direction: 'syn', compute: () => 1 },
      b: { direction: 'syn', compute: () => 2 },
    };
    expect(() => validateDispatch(dispatch, ['a', 'b'])).not.toThrow();
  });

  it('throws when dispatch is missing attrs', () => {
    const dispatch: DispatchConfig = {
      a: { direction: 'syn', compute: () => 1 },
    };
    expect(() => validateDispatch(dispatch, ['a', 'b']))
      .toThrow('Missing dispatch entries for attributes: b');
  });

  it('throws when dispatch has extra entries', () => {
    const dispatch: DispatchConfig = {
      a: { direction: 'syn', compute: () => 1 },
      b: { direction: 'syn', compute: () => 2 },
    };
    expect(() => validateDispatch(dispatch, ['a']))
      .toThrow('Extra dispatch entries not in spec: b');
  });
});
