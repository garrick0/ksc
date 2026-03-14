/**
 * Evaluator error path tests: unknown attribute, cycle detection, equation throws.
 */
import { describe, it, expect } from 'vitest';
import { buildTree } from '@ksc/evaluation/domain/evaluator-index.js';
import type { DispatchConfig } from '@ksc/ag-ports';
import type { Grammar } from '@ksc/grammar/index.js';

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

describe('evaluator errors — unknown attribute', () => {
  it('throws with attribute name and node kind in message', () => {
    const tree = buildTree({ grammar: testGrammar, dispatch: {}, root: makeTree() });
    expect(() => tree.attr('nonexistent')).toThrow("Unknown attribute 'nonexistent'");
    expect(() => tree.attr('nonexistent')).toThrow('Root');
    expect(() => tree.children[0].attr('bogus')).toThrow('Leaf');
  });
});

describe('evaluator errors — cycle detection', () => {
  it('detects self-referencing syn attribute', () => {
    const dispatch: DispatchConfig = {
      selfLoop: { direction: 'syn', compute: (ctx) => ctx.attr('selfLoop') },
    };
    const tree = buildTree({ grammar: testGrammar, dispatch, root: makeTree() });
    expect(() => tree.attr('selfLoop')).toThrow('Circular attribute access');
  });

  it('detects mutual recursion between two attributes', () => {
    const dispatch: DispatchConfig = {
      attrA: { direction: 'syn', compute: (ctx) => ctx.attr('attrB') },
      attrB: { direction: 'syn', compute: (ctx) => ctx.attr('attrA') },
    };
    const tree = buildTree({ grammar: testGrammar, dispatch, root: makeTree() });
    expect(() => tree.attr('attrA')).toThrow('Circular attribute access');
  });

  it('does not false-positive on same attr with different params', () => {
    let callCount = 0;
    const dispatch: DispatchConfig = {
      lookup: { direction: 'syn', compute: (_ctx, key) => { callCount++; return `val:${key}`; } },
    };
    const tree = buildTree({ grammar: testGrammar, dispatch, root: makeTree() });
    expect(tree.attr('lookup', 'a')).toBe('val:a');
    expect(tree.attr('lookup', 'b')).toBe('val:b');
    expect(callCount).toBe(2);
  });
});

describe('evaluator errors — equation throws', () => {
  it('propagates error from syn equation', () => {
    const dispatch: DispatchConfig = {
      broken: { direction: 'syn', compute: () => { throw new Error('equation failed'); } },
    };
    const tree = buildTree({ grammar: testGrammar, dispatch, root: makeTree() });
    expect(() => tree.attr('broken')).toThrow('equation failed');
  });

  it('propagates error from inh parent equation', () => {
    const dispatch: DispatchConfig = {
      badParent: {
        direction: 'inh',
        computeRoot: () => 'ok',
        computeParent: () => { throw new RangeError('parent boom'); },
      },
    };
    const tree = buildTree({ grammar: testGrammar, dispatch, root: makeTree() });
    expect(tree.attr('badParent')).toBe('ok');
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
    const tree = buildTree({ grammar: testGrammar, dispatch, root: makeTree() });
    expect(() => tree.attr('flaky')).toThrow('transient');
    shouldThrow = false;
    expect(tree.attr('flaky')).toBe('recovered');
  });
});
