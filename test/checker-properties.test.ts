/**
 * Tests for new checker properties: noConsole, immutable, noMutation, noIO, noSideEffects.
 * Tests multi-property kinds and clean (no-violation) cases.
 */
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { createProgram } from '../app/lib/program.js';

const FIXTURES = path.resolve(__dirname, 'fixtures');

function getRootFiles(fixtureDir: string): string[] {
  return ts.sys.readDirectory(
    path.join(FIXTURES, fixtureDir, 'src'),
    ['.ts'],
  );
}

const _fixtureCache = new Map();
function getDiagnosticsForFixture(fixtureDir: string) {
  if (_fixtureCache.has(fixtureDir)) return _fixtureCache.get(fixtureDir);
  const program = createProgram(getRootFiles(fixtureDir), undefined, {
    strict: true, noEmit: true,
  });
  const result = {
    diagnostics: program.getDiagnostics(),
    definitions: program.getKindDefinitions(),
  };
  _fixtureCache.set(fixtureDir, result);
  return result;
}

// ────────────────────────────────────────────────────────────────────────

describe('checker properties — noConsole', () => {
  it('detects console.log in NoConsole-annotated function', () => {
    const { diagnostics } = getDiagnosticsForFixture('checker-properties');
    const violations = diagnostics.filter(d =>
      d.fileName.includes('no-console-violation.ts') && d.property === 'noConsole',
    );
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].message).toContain('console.log');
    expect(violations[0].kindName).toBe('NoConsole');
  });

  it('no violations in clean NoConsole-annotated function', () => {
    const { diagnostics } = getDiagnosticsForFixture('checker-properties');
    const violations = diagnostics.filter(d =>
      d.fileName.includes('no-console-clean.ts') && d.property === 'noConsole',
    );
    expect(violations).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker properties — immutable', () => {
  it('detects let binding in Immutable-annotated function', () => {
    const { diagnostics } = getDiagnosticsForFixture('checker-properties');
    const violations = diagnostics.filter(d =>
      d.fileName.includes('immutable-violation.ts') && d.property === 'immutable',
    );
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].message).toContain('let');
    expect(violations[0].kindName).toBe('Immutable');
  });

  it('no violations with const-only Immutable function', () => {
    const { diagnostics } = getDiagnosticsForFixture('checker-properties');
    const violations = diagnostics.filter(d =>
      d.fileName.includes('immutable-clean.ts') && d.property === 'immutable',
    );
    expect(violations).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker properties — noMutation', () => {
  it('detects assignment and increment in NoMutation-annotated function', () => {
    const { diagnostics } = getDiagnosticsForFixture('checker-properties');
    const violations = diagnostics.filter(d =>
      d.fileName.includes('no-mutation-violation.ts') && d.property === 'noMutation',
    );
    // Should flag: y = y + 1 (EqualsToken assignment) and y++ (postfix ++)
    expect(violations.length).toBeGreaterThanOrEqual(2);
    const messages = violations.map(d => d.message);
    expect(messages.some(m => m.includes('EqualsToken'))).toBe(true);
    expect(messages.some(m => m.includes('++'))).toBe(true);
  });

  it('no violations in clean NoMutation function', () => {
    const { diagnostics } = getDiagnosticsForFixture('checker-properties');
    const violations = diagnostics.filter(d =>
      d.fileName.includes('no-mutation-clean.ts') && d.property === 'noMutation',
    );
    expect(violations).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker properties — noIO', () => {
  it('detects IO module usage in NoIO-annotated function', () => {
    const { diagnostics } = getDiagnosticsForFixture('checker-properties');
    const violations = diagnostics.filter(d =>
      d.fileName.includes('no-io-violation.ts') && d.property === 'noIO',
    );
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].message).toContain('fs');
    expect(violations[0].kindName).toBe('NoIO');
  });

  it('no violations in clean NoIO function', () => {
    const { diagnostics } = getDiagnosticsForFixture('checker-properties');
    const violations = diagnostics.filter(d =>
      d.fileName.includes('no-io-clean.ts') && d.property === 'noIO',
    );
    expect(violations).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker properties — noSideEffects', () => {
  it('detects call expression statement in NoSideEffects-annotated function', () => {
    const { diagnostics } = getDiagnosticsForFixture('checker-properties');
    const violations = diagnostics.filter(d =>
      d.fileName.includes('no-side-effects-violation.ts') && d.property === 'noSideEffects',
    );
    // sideEffect(x) is a CallExpression used as a statement — should be flagged
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].message).toContain('CallExpression');
    expect(violations[0].message).toContain('side effect');
  });

  it('no violations in expression-only clean function', () => {
    const { diagnostics } = getDiagnosticsForFixture('checker-properties');
    const violations = diagnostics.filter(d =>
      d.fileName.includes('no-side-effects-clean.ts') && d.property === 'noSideEffects',
    );
    expect(violations).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker properties — static', () => {
  it('detects dynamic import() in Static-annotated function', () => {
    const { diagnostics } = getDiagnosticsForFixture('checker-properties');
    const violations = diagnostics.filter(d =>
      d.fileName.includes('static-violation.ts') && d.property === 'static',
    );
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].message).toContain('dynamic import()');
    expect(violations[0].kindName).toBe('Static');
  });

  it('no violations in clean Static function', () => {
    const { diagnostics } = getDiagnosticsForFixture('checker-properties');
    const violations = diagnostics.filter(d =>
      d.fileName.includes('static-clean.ts') && d.property === 'static',
    );
    expect(violations).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker properties — multi-property kind', () => {
  it('StrictFunc (noImports+noConsole+immutable+noMutation) flags multiple violations', () => {
    const { diagnostics } = getDiagnosticsForFixture('checker-properties');
    const violations = diagnostics.filter(d =>
      d.fileName.includes('multi-property.ts'),
    );
    // Should have violations for: console.log (noConsole), let binding (immutable),
    // assignment (noMutation), imported readFileSync (noImports)
    expect(violations.length).toBeGreaterThanOrEqual(3);

    const properties = new Set(violations.map(d => d.property));
    expect(properties.has('noConsole')).toBe(true);
    expect(properties.has('immutable')).toBe(true);
    expect(properties.has('noMutation')).toBe(true);
  });

  it('all multi-property violations reference StrictFunc', () => {
    const { diagnostics } = getDiagnosticsForFixture('checker-properties');
    const violations = diagnostics.filter(d =>
      d.fileName.includes('multi-property.ts'),
    );
    for (const v of violations) {
      expect(v.kindName).toBe('StrictFunc');
    }
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker properties — kind definitions', () => {
  it('finds all defined kinds', () => {
    const { definitions } = getDiagnosticsForFixture('checker-properties');
    const names = definitions.map(d => d.name);
    expect(names).toContain('NoConsole');
    expect(names).toContain('Immutable');
    expect(names).toContain('Static');
    expect(names).toContain('NoSideEffects');
    expect(names).toContain('NoMutation');
    expect(names).toContain('NoIO');
    expect(names).toContain('Pure');
    expect(names).toContain('StrictFunc');
  });

  it('StrictFunc has multiple properties', () => {
    const { definitions } = getDiagnosticsForFixture('checker-properties');
    const strict = definitions.find(d => d.name === 'StrictFunc')!;
    expect(strict).toBeDefined();
    expect(strict.properties.noImports).toBe(true);
    expect(strict.properties.noConsole).toBe(true);
    expect(strict.properties.immutable).toBe(true);
    expect(strict.properties.noMutation).toBe(true);
  });
});
