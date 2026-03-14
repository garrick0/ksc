/**
 * Tests for checker properties: noConsole, immutable, noMutation, noIO, noSideEffects, static.
 * Tests multi-property kinds and kind definitions.
 */
import { describe, it, expect } from 'vitest';
import { buildProgram } from '../helpers/fixtures.js';

function getDiagnosticsForFixture(fixtureDir: string) {
  const program = buildProgram(fixtureDir);
  return {
    diagnostics: program.getDiagnostics(),
    definitions: program.getKindDefinitions(),
  };
}

describe('checker properties — single-property violations', () => {
  it('each property detects its violation and has no false positives on clean files', () => {
    const { diagnostics } = getDiagnosticsForFixture('checker-properties');

    // noConsole
    const noConsole = diagnostics.filter(d => d.fileName.includes('no-console-violation.ts') && d.property === 'noConsole');
    expect(noConsole.length).toBeGreaterThanOrEqual(1);
    expect(noConsole[0].message).toContain('console.log');
    expect(diagnostics.filter(d => d.fileName.includes('no-console-clean.ts') && d.property === 'noConsole')).toEqual([]);

    // immutable
    const immutable = diagnostics.filter(d => d.fileName.includes('immutable-violation.ts') && d.property === 'immutable');
    expect(immutable.length).toBeGreaterThanOrEqual(1);
    expect(immutable[0].message).toContain('let');
    expect(diagnostics.filter(d => d.fileName.includes('immutable-clean.ts') && d.property === 'immutable')).toEqual([]);

    // noMutation
    const noMutation = diagnostics.filter(d => d.fileName.includes('no-mutation-violation.ts') && d.property === 'noMutation');
    expect(noMutation.length).toBeGreaterThanOrEqual(2);
    const mutMessages = noMutation.map(d => d.message);
    expect(mutMessages.some(m => m.includes('EqualsToken'))).toBe(true);
    expect(mutMessages.some(m => m.includes('++'))).toBe(true);
    expect(diagnostics.filter(d => d.fileName.includes('no-mutation-clean.ts') && d.property === 'noMutation')).toEqual([]);

    // noIO
    const noIO = diagnostics.filter(d => d.fileName.includes('no-io-violation.ts') && d.property === 'noIO');
    expect(noIO.length).toBeGreaterThanOrEqual(1);
    expect(noIO[0].message).toContain('fs');
    expect(diagnostics.filter(d => d.fileName.includes('no-io-clean.ts') && d.property === 'noIO')).toEqual([]);

    // noSideEffects
    const noSideEffects = diagnostics.filter(d => d.fileName.includes('no-side-effects-violation.ts') && d.property === 'noSideEffects');
    expect(noSideEffects.length).toBeGreaterThanOrEqual(1);
    expect(noSideEffects[0].message).toContain('side effect');
    expect(diagnostics.filter(d => d.fileName.includes('no-side-effects-clean.ts') && d.property === 'noSideEffects')).toEqual([]);

    // static
    const staticV = diagnostics.filter(d => d.fileName.includes('static-violation.ts') && d.property === 'static');
    expect(staticV.length).toBeGreaterThanOrEqual(1);
    expect(staticV[0].message).toContain('dynamic import()');
    expect(diagnostics.filter(d => d.fileName.includes('static-clean.ts') && d.property === 'static')).toEqual([]);
  });
});

describe('checker properties — multi-property kind', () => {
  it('StrictFunc (noImports+noConsole+immutable+noMutation) flags multiple violations', () => {
    const { diagnostics } = getDiagnosticsForFixture('checker-properties');
    const violations = diagnostics.filter(d => d.fileName.includes('multi-property.ts'));
    expect(violations.length).toBeGreaterThanOrEqual(3);

    const properties = new Set(violations.map(d => d.property));
    expect(properties.has('noConsole')).toBe(true);
    expect(properties.has('immutable')).toBe(true);
    expect(properties.has('noMutation')).toBe(true);

    for (const v of violations) expect(v.kindName).toBe('StrictFunc');
  });
});

describe('checker properties — kind definitions', () => {
  it('finds all defined kinds with correct properties', () => {
    const { definitions } = getDiagnosticsForFixture('checker-properties');
    const names = definitions.map(d => d.name);
    for (const kind of ['NoConsole', 'Immutable', 'Static', 'NoSideEffects', 'NoMutation', 'NoIO', 'Pure', 'StrictFunc']) {
      expect(names).toContain(kind);
    }

    const strict = definitions.find(d => d.name === 'StrictFunc')!;
    expect(strict.properties.noImports).toBe(true);
    expect(strict.properties.noConsole).toBe(true);
    expect(strict.properties.immutable).toBe(true);
    expect(strict.properties.noMutation).toBe(true);
  });
});

describe('checker properties — clean files produce zero violations', () => {
  it('no violations for any property on clean fixture files', () => {
    const { diagnostics } = getDiagnosticsForFixture('checker-properties');
    const cleanFiles = diagnostics.filter(d => d.fileName.includes('-clean.'));
    expect(cleanFiles).toEqual([]);
  });
});
