/**
 * Unit tests for assembleFieldExtractors — generic field extractor assembly.
 *
 * Tests the assembly logic with synthetic data (no TS-specific dependencies).
 */
import { describe, it, expect } from 'vitest';
import { assembleFieldExtractors } from '../grammar/field-extractors.js';
import type { NodeEntry } from '../grammar/builder.js';

const nodes = new Map<string, NodeEntry>([
  ['Alpha', {
    kind: 'Alpha',
    fields: { x: { tag: 'prop', propType: 'number' }, typeString: { tag: 'prop', propType: 'string' } },
    memberOf: [],
  }],
  ['Beta', {
    kind: 'Beta',
    fields: { y: { tag: 'child', typeRef: 'Alpha' } },
    memberOf: [],
  }],
  ['Gamma', {
    kind: 'Gamma',
    fields: { z: { tag: 'prop', propType: 'boolean' }, typeString: { tag: 'prop', propType: 'string' } },
    memberOf: [],
  }],
]);

describe('assembleFieldExtractors', () => {
  it('copies base extractors', () => {
    const result = assembleFieldExtractors(nodes, {
      base: { Alpha: { x: 'customExpr(n)' } },
      kindRules: [],
    });
    expect(result.Alpha.x).toBe('customExpr(n)');
  });

  it('applies kind rules to specified kinds', () => {
    const result = assembleFieldExtractors(nodes, {
      base: {},
      kindRules: [
        { kinds: ['Alpha', 'Beta'], fieldName: 'isExported', expression: 'isNodeExported(node)' },
      ],
    });
    expect(result.Alpha.isExported).toBe('isNodeExported(node)');
    expect(result.Beta.isExported).toBe('isNodeExported(node)');
    expect(result.Gamma).toBeUndefined();
  });

  it('auto-detects fields present in schema', () => {
    const result = assembleFieldExtractors(nodes, {
      base: {},
      kindRules: [],
      autoDetectFields: [
        { fieldName: 'typeString', expression: 'getTypeString(node)' },
      ],
    });
    expect(result.Alpha.typeString).toBe('getTypeString(node)');
    expect(result.Gamma.typeString).toBe('getTypeString(node)');
    // Beta doesn't have typeString field
    expect(result.Beta).toBeUndefined();
  });

  it('base extractors take precedence over auto-detect', () => {
    const result = assembleFieldExtractors(nodes, {
      base: { Alpha: { typeString: 'customTypeExpr(n)' } },
      kindRules: [],
      autoDetectFields: [
        { fieldName: 'typeString', expression: 'getTypeString(node)' },
      ],
    });
    expect(result.Alpha.typeString).toBe('customTypeExpr(n)');
    expect(result.Gamma.typeString).toBe('getTypeString(node)');
  });

  it('kind rules overwrite base extractors', () => {
    const result = assembleFieldExtractors(nodes, {
      base: { Alpha: { x: 'baseExpr(n)' } },
      kindRules: [
        { kinds: ['Alpha'], fieldName: 'x', expression: 'kindRuleExpr(n)' },
      ],
    });
    expect(result.Alpha.x).toBe('kindRuleExpr(n)');
  });

  it('kind rules take precedence over auto-detect', () => {
    const result = assembleFieldExtractors(nodes, {
      base: {},
      kindRules: [
        { kinds: ['Alpha'], fieldName: 'typeString', expression: 'kindRuleExpr(node)' },
      ],
      autoDetectFields: [
        { fieldName: 'typeString', expression: 'getTypeString(node)' },
      ],
    });
    expect(result.Alpha.typeString).toBe('kindRuleExpr(node)');
    expect(result.Gamma.typeString).toBe('getTypeString(node)');
  });

  it('returns empty result with no config', () => {
    const result = assembleFieldExtractors(nodes, {
      base: {},
      kindRules: [],
    });
    expect(Object.keys(result)).toHaveLength(0);
  });
});
