/**
 * Unit tests for Functor 1: compileGrammar
 *
 * Tests the pure compilation function with a minimal grammar.
 */
import { describe, it, expect } from 'vitest';
import { compileGrammar } from '../grammar/compile.js';
import type { GrammarSpec, ConvertGenerator } from '../grammar/types.js';
import type { NodeEntry, SumTypeEntry } from '../grammar/builder.js';
import { buildConverterEntries, emitConverterRegistrations } from '../grammar/convert-codegen.js';

function makeMinimalSpec(): GrammarSpec {
  const nodes = new Map<string, NodeEntry>([
    ['Identifier', {
      kind: 'Identifier',
      fields: { escapedText: { tag: 'prop', propType: 'string' } },
      memberOf: ['Expression'],
    }],
    ['NumericLiteral', {
      kind: 'NumericLiteral',
      fields: { value: { tag: 'prop', propType: 'string' } },
      memberOf: ['Expression'],
    }],
    ['BinaryExpression', {
      kind: 'BinaryExpression',
      fields: {
        left: { tag: 'child', typeRef: 'Expression' },
        right: { tag: 'child', typeRef: 'Expression' },
        operator: { tag: 'prop', propType: 'string' },
      },
      memberOf: ['Expression'],
    }],
  ]);

  const sumTypes = new Map<string, SumTypeEntry>([
    ['Expression', {
      name: 'Expression',
      members: ['Identifier', 'NumericLiteral', 'BinaryExpression'],
      includes: [],
    }],
  ]);

  const convertGenerator: ConvertGenerator = () => {
    const entries = buildConverterEntries({
      nodes, sumTypes, fieldExtractors: {},
      skipConvert: new Set(), syntaxKindOverrides: {},
      jsDocMembers: new Set(),
    });
    const registrations = emitConverterRegistrations(entries, (kind) => `SyntaxKind.${kind}`);
    return ['// AUTO-GENERATED convert.ts', '', ...registrations].join('\n');
  };

  return { nodes, sumTypes, convertGenerator };
}

describe('compileGrammar — minimal grammar', () => {
  const spec = makeMinimalSpec();
  const result = compileGrammar(spec);

  it('produces 7 output files', () => {
    expect(result.files).toHaveLength(7);
    const paths = result.files.map(f => f.path);
    expect(paths).toContain('node-types.ts');
    expect(paths).toContain('schema.ts');
    expect(paths).toContain('convert.ts');
    expect(paths).toContain('builders.ts');
    expect(paths).toContain('serialize.ts');
    expect(paths).toContain('kind-map.ts');
    expect(paths).toContain('index.ts');
  });

  it('tracks all kinds', () => {
    expect(result.kinds.size).toBe(3);
    expect(result.hasKind('Identifier')).toBe(true);
    expect(result.hasKind('NumericLiteral')).toBe(true);
    expect(result.hasKind('BinaryExpression')).toBe(true);
    expect(result.hasKind('NonExistent')).toBe(false);
  });

  it('node-types.ts contains interfaces for all node kinds', () => {
    const nodeTypes = result.files.find(f => f.path === 'node-types.ts')!.content;
    expect(nodeTypes).toContain('export interface KSIdentifier');
    expect(nodeTypes).toContain('export interface KSNumericLiteral');
    expect(nodeTypes).toContain('export interface KSBinaryExpression');
  });

  it('node-types.ts contains sum type union', () => {
    const nodeTypes = result.files.find(f => f.path === 'node-types.ts')!.content;
    expect(nodeTypes).toContain('export type KSExpression =');
    expect(nodeTypes).toContain('KSIdentifier');
  });

  it('node-types.ts contains type guard for sum type', () => {
    const nodeTypes = result.files.find(f => f.path === 'node-types.ts')!.content;
    expect(nodeTypes).toContain('isExpression');
  });

  it('schema.ts contains getChildFields entries', () => {
    const schema = result.files.find(f => f.path === 'schema.ts')!.content;
    expect(schema).toContain('getChildFields');
    expect(schema).toContain("'BinaryExpression'");
  });

  it('builders.ts contains factory functions', () => {
    const builders = result.files.find(f => f.path === 'builders.ts')!.content;
    expect(builders).toContain('createIdentifier');
    expect(builders).toContain('createBinaryExpression');
  });

  it('kind-map.ts contains KindToNode type', () => {
    const kindMap = result.files.find(f => f.path === 'kind-map.ts')!.content;
    expect(kindMap).toContain('KindToNode');
    expect(kindMap).toContain("'Identifier': KSIdentifier");
  });

  it('all files have auto-generated header', () => {
    for (const file of result.files) {
      expect(file.content).toContain('AUTO-GENERATED');
    }
  });
});

describe('compileGrammar — options', () => {
  it('skipConvert excludes specified kinds from convert.ts', () => {
    const spec = makeMinimalSpec();
    const nodes = spec.nodes;
    const sumTypes = spec.sumTypes;
    spec.convertGenerator = () => {
      const entries = buildConverterEntries({
        nodes, sumTypes, fieldExtractors: {},
        skipConvert: new Set(['Identifier']),
        syntaxKindOverrides: {}, jsDocMembers: new Set(),
      });
      const registrations = emitConverterRegistrations(entries, (kind) => `SyntaxKind.${kind}`);
      return ['// AUTO-GENERATED convert.ts', '', ...registrations].join('\n');
    };
    const result = compileGrammar(spec);
    const convert = result.files.find(f => f.path === 'convert.ts')!.content;
    expect(convert).toContain("'BinaryExpression'");
  });

  it('field extractors are used in convert.ts', () => {
    const spec = makeMinimalSpec();
    const nodes = spec.nodes;
    const sumTypes = spec.sumTypes;
    spec.convertGenerator = () => {
      const entries = buildConverterEntries({
        nodes, sumTypes,
        fieldExtractors: { Identifier: { escapedText: 'customExtractor(n)' } },
        skipConvert: new Set(), syntaxKindOverrides: {},
        jsDocMembers: new Set(),
      });
      const registrations = emitConverterRegistrations(entries, (kind) => `SyntaxKind.${kind}`);
      return ['// AUTO-GENERATED convert.ts', '', ...registrations].join('\n');
    };
    const result = compileGrammar(spec);
    const convert = result.files.find(f => f.path === 'convert.ts')!.content;
    expect(convert).toContain('customExtractor(n)');
  });
});
