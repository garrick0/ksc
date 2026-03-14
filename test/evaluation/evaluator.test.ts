/**
 * Unit tests for the AG evaluator engine.
 *
 * Tests AG patterns (syn, inh, collection, caching, structural queries,
 * direct evaluation) using minimal inline dispatch configs.
 */
import { describe, it, expect } from 'vitest';
import { buildTree, evaluate, validateDispatch } from '@ksc/evaluation/domain/evaluator-index.js';
import type { DispatchConfig } from '@ksc/ag-ports';
import type { Grammar } from '@ksc/grammar/index.js';

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
  fileContainerKind: 'Root',
  fileNameField: 'fileName',
  sumTypeMembers: {},
  sumTypeMembership: {},
};

describe('evaluator — syn attributes', () => {
  it('computes a syn attribute from dispatch', () => {
    const dispatch: DispatchConfig = {
      label: { direction: 'syn', compute: (ctx) => `node:${ctx.node.kind}` },
    };
    const tree = buildTree({ grammar: testGrammar, dispatch, root: makeTestTree().root });
    expect(tree.attr('label')).toBe('node:Root');
    expect(tree.children[0].attr('label')).toBe('node:Inner');
  });

  it('throws for unknown attribute', () => {
    const tree = buildTree({ grammar: testGrammar, dispatch: {}, root: makeTestTree().root });
    expect(() => tree.attr('nonexistent')).toThrow('Unknown attribute');
  });
});

describe('evaluator — caching', () => {
  it('caches non-parameterized attributes (compute called once)', () => {
    let callCount = 0;
    const dispatch: DispatchConfig = {
      counted: { direction: 'syn', compute: () => { callCount++; return 42; } },
    };
    const tree = buildTree({ grammar: testGrammar, dispatch, root: makeTestTree().root });
    expect(tree.attr('counted')).toBe(42);
    expect(tree.attr('counted')).toBe(42);
    expect(callCount).toBe(1);
  });

  it('caches parameterized attributes per-param', () => {
    let callCount = 0;
    const dispatch: DispatchConfig = {
      lookup: { direction: 'syn', compute: (_ctx, key) => { callCount++; return `${key}!`; } },
    };
    const tree = buildTree({ grammar: testGrammar, dispatch, root: makeTestTree().root });
    expect(tree.attr('lookup', 'a')).toBe('a!');
    expect(tree.attr('lookup', 'b')).toBe('b!');
    expect(tree.attr('lookup', 'a')).toBe('a!');
    expect(callCount).toBe(2);
  });
});

describe('evaluator — inh attributes', () => {
  it('uses root value at the root node', () => {
    const dispatch: DispatchConfig = {
      depth: { direction: 'inh', computeRoot: () => 0 },
    };
    const tree = buildTree({ grammar: testGrammar, dispatch, root: makeTestTree().root });
    expect(tree.attr('depth')).toBe(0);
  });

  it('copies down when no parent override', () => {
    const dispatch: DispatchConfig = {
      env: { direction: 'inh', computeRoot: () => 'root-env' },
    };
    const tree = buildTree({ grammar: testGrammar, dispatch, root: makeTestTree().root });
    expect(tree.children[0].attr('env')).toBe('root-env');
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
    const tree = buildTree({ grammar: testGrammar, dispatch, root: makeTestTree().root });
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
          if (ctx.parent!.node.kind === 'Inner') return 'overridden';
          return undefined;
        },
      },
    };
    const tree = buildTree({ grammar: testGrammar, dispatch, root: makeTestTree().root });
    expect(tree.attr('flag')).toBe('initial');
    expect(tree.children[0].attr('flag')).toBe('initial');
    expect(tree.children[0].children[0].attr('flag')).toBe('overridden');
  });
});

describe('evaluator — collection attributes', () => {
  it('folds over children with init and combine', () => {
    const dispatch: DispatchConfig = {
      nodeCount: { direction: 'collection', init: 1, combine: (acc: number, child: number) => acc + child },
    };
    const tree = buildTree({ grammar: testGrammar, dispatch, root: makeTestTree().root });
    expect(tree.children[1].attr('nodeCount')).toBe(1);
    expect(tree.children[0].attr('nodeCount')).toBe(2);
    expect(tree.attr('nodeCount')).toBe(4);
  });
});

describe('evaluator — structural queries', () => {
  it('parentIs checks kind and field', () => {
    const tree = buildTree({ grammar: testGrammar, dispatch: {}, root: makeTestTree().root });
    expect(tree.children[0].parentIs('Root')).toBe(true);
    expect(tree.children[0].parentIs('Root', 'children')).toBe(true);
    expect(tree.children[0].parentIs('Root', 'other')).toBe(false);
  });

  it('root has no parent', () => {
    const tree = buildTree({ grammar: testGrammar, dispatch: {}, root: makeTestTree().root });
    expect(tree.isRoot).toBe(true);
    expect(tree.parent).toBeUndefined();
  });
});

describe('evaluator — tree building', () => {
  it('builds correct parent-child relationships and preserves node refs', () => {
    const { root, A, C } = makeTestTree();
    const tree = buildTree({ grammar: testGrammar, dispatch: {}, root });

    expect(tree.children.length).toBe(2);
    expect(tree.children[0].parent).toBe(tree);
    expect(tree.children[0].children[0].parent).toBe(tree.children[0]);
    expect(tree.node).toBe(root);
    expect(tree.children[0].node).toBe(A);
    expect(tree.children[0].children[0].node).toBe(C);
  });
});

describe('evaluator — evaluate', () => {
  it('calls setup before evaluation and returns a typed tree', () => {
    const dispatch: DispatchConfig = {
      nodeCount: { direction: 'collection', init: 1, combine: (acc: number, child: number) => acc + child },
    };
    let setupCalled = false;
    const tree = evaluate({
      grammar: testGrammar,
      dispatch,
      root: makeTestTree().root,
      setup: () => { setupCalled = true; },
    });
    expect(tree.attr('nodeCount')).toBe(4);
    expect(setupCalled).toBe(true);
  });
});

describe('evaluator — validateDispatch', () => {
  it('passes when dispatch matches attr names', () => {
    const dispatch: DispatchConfig = {
      a: { direction: 'syn', compute: () => 1 },
      b: { direction: 'syn', compute: () => 2 },
    };
    expect(() => validateDispatch(dispatch, ['a', 'b'])).not.toThrow();
  });

  it('throws when dispatch has missing or extra entries', () => {
    const dispatch: DispatchConfig = {
      a: { direction: 'syn', compute: () => 1 },
    };
    expect(() => validateDispatch(dispatch, ['a', 'b'])).toThrow('Missing dispatch entries');
    expect(() => validateDispatch({ ...dispatch, b: { direction: 'syn', compute: () => 2 } }, ['a'])).toThrow('Extra dispatch entries');
  });
});
