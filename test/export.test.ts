import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { createProgram } from '../src/program.js';
import { exportDashboardData } from '../src/dashboard/export.js';
import type { KSProgramInterface } from '../src/pipeline/types.js';

const FIXTURES = path.resolve(__dirname, 'fixtures');

function createFixtureProgram(fixtureName: string): KSProgramInterface {
  const fixtureDir = path.join(FIXTURES, fixtureName);
  const rootFiles = ts.sys.readDirectory(
    path.join(fixtureDir, 'src'),
    ['.ts'],
  );
  return createProgram(rootFiles, undefined, {
    strict: true,
    noEmit: true,
    rootDir: fixtureDir,
  });
}

// ────────────────────────────────────────────────────────────────────────

describe('exportDashboardData — structure', () => {
  it('returns correct top-level shape', () => {
    const program = createFixtureProgram('kind-basic');
    const data = exportDashboardData(program, { root: '/test' });

    expect(data.version).toBe(2);
    expect(data.project.root).toBe('/test');
    expect(data.project.generatedAt).toBeTruthy();
    expect(data.project.rootFiles.length).toBeGreaterThan(0);
    expect(data.parse).toBeDefined();
    expect(data.kinds).toBeDefined();
  });

  it('parse stage lists source files with declarations', () => {
    const program = createFixtureProgram('kind-basic');
    const data = exportDashboardData(program);

    expect(data.parse.sourceFiles.length).toBeGreaterThan(0);
    for (const sf of data.parse.sourceFiles) {
      expect(sf.fileName).toBeTruthy();
      expect(sf.lineCount).toBeGreaterThan(0);
      expect(Array.isArray(sf.declarations)).toBe(true);
    }
  });

  it('parse stage includes source text when requested', () => {
    const program = createFixtureProgram('kind-basic');
    const withSource = exportDashboardData(program, { includeSource: true });
    const withoutSource = exportDashboardData(program);

    const sfWith = withSource.parse.sourceFiles[0];
    const sfWithout = withoutSource.parse.sourceFiles[0];

    expect(sfWith.source).toBeTruthy();
    expect(sfWithout.source).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('exportDashboardData — kinds stage', () => {
  it('lists kind definitions', () => {
    const program = createFixtureProgram('kind-basic');
    const data = exportDashboardData(program);

    expect(data.kinds.definitions.length).toBeGreaterThan(0);
    const names = data.kinds.definitions.map(d => d.name);
    expect(names).toContain('NoImports');
  });

  it('definitions have properties', () => {
    const program = createFixtureProgram('kind-basic');
    const data = exportDashboardData(program);

    const noImports = data.kinds.definitions.find(d => d.name === 'NoImports');
    expect(noImports).toBeDefined();
    expect(noImports!.properties).toHaveProperty('noImports', true);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('exportDashboardData — annotations', () => {
  it('extracts kind annotations from annotated variables', () => {
    const program = createFixtureProgram('kind-violations');
    const data = exportDashboardData(program);

    expect(data.kinds.annotations.length).toBeGreaterThan(0);
    const ann = data.kinds.annotations.find(a => a.kindName === 'NoImports');
    expect(ann).toBeDefined();
    expect(ann!.sourceFile).toBeTruthy();
  });

  it('includes no annotations for clean fixture', () => {
    const file = path.join(FIXTURES, 'checker-clean', 'src', 'pure', 'math.ts');
    const program = createProgram([file]);
    const data = exportDashboardData(program);

    expect(data.kinds.annotations).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('exportDashboardData — check stage', () => {
  it('includes check section with diagnostics for violations', () => {
    const program = createFixtureProgram('kind-violations');
    const data = exportDashboardData(program);

    expect(data.check).toBeDefined();
    expect(data.check.diagnostics.length).toBeGreaterThanOrEqual(1);

    const diag = data.check.diagnostics[0];
    expect(diag.id).toBeTruthy();
    expect(diag.file).toBeTruthy();
    expect(diag.code).toBe(70200);
    expect(diag.property).toBe('noImports');
    expect(diag.message).toBeTruthy();
    expect(diag.start).toBeGreaterThanOrEqual(0);
    expect(diag.length).toBeGreaterThan(0);
    expect(diag.line).toBeGreaterThanOrEqual(1);
    expect(diag.column).toBeGreaterThanOrEqual(1);
  });

  it('includes summary with correct counts', () => {
    const program = createFixtureProgram('kind-violations');
    const data = exportDashboardData(program);

    const s = data.check.summary;
    expect(s.totalFiles).toBeGreaterThan(0);
    expect(s.totalDiagnostics).toBe(data.check.diagnostics.length);
    expect(s.violatingFiles).toBeGreaterThan(0);
    expect(s.cleanFiles).toBe(s.totalFiles - s.violatingFiles);
  });

  it('check section is empty for clean code', () => {
    const program = createFixtureProgram('kind-basic');
    const data = exportDashboardData(program);

    expect(data.check.diagnostics).toEqual([]);
    expect(data.check.summary.totalDiagnostics).toBe(0);
    expect(data.check.summary.violatingFiles).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('exportDashboardData — no kinds', () => {
  it('works with files that have no kind definitions', () => {
    const file = path.join(FIXTURES, 'checker-clean', 'src', 'pure', 'math.ts');
    const program = createProgram([file]);
    const data = exportDashboardData(program);

    expect(data.kinds.definitions).toEqual([]);
    expect(data.kinds.annotations).toEqual([]);
    expect(data.check.diagnostics).toEqual([]);
  });
});
