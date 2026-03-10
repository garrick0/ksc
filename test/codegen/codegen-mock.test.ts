/**
 * Tests for the mock analysis composition root.
 *
 * Verifies that the analysis codegen pipeline works with the mock grammar.
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const ROOT = path.resolve(import.meta.dirname!, '../..');
const MOCK_OUT = path.join(ROOT, 'generated-mock');

describe('mock composition root', () => {
  it('runs analysis codegen for mock successfully', () => {
    const analysisOutput = execSync('npx tsx app/analysis-codegen/mock.ts', {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 30000,
    });

    expect(analysisOutput).toContain('Cross-Functor Validation');
    expect(analysisOutput).toContain('Functor 2: Analysis Compilation');
    expect(analysisOutput).toContain('Done!');
  });

  it('generates dispatch with mock spec import path', () => {
    const content = fs.readFileSync(path.join(MOCK_OUT, 'mock', 'mock-analysis', 'dispatch.ts'), 'utf-8');
    expect(content).toContain("from '../../../specs/mock/mock-analysis/");
    expect(content).not.toContain('kind-checking');
  });

  it('generates attr-types with nodeCount attribute', () => {
    const content = fs.readFileSync(path.join(MOCK_OUT, 'mock', 'mock-analysis', 'attr-types.ts'), 'utf-8');
    expect(content).toContain('nodeCount');
    expect(content).not.toContain('kindDefs');
    expect(content).not.toContain('defEnv');
  });
});

describe('mock vs ts-ast isolation', () => {
  it('ts-ast analysis codegen still works after mock codegen', () => {
    const analysisOutput = execSync('npx tsx app/analysis-codegen/ts-kind-checking.ts', {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 30000,
    });

    expect(analysisOutput).toContain('Done!');
  });

  it('ts-ast dispatch still references kind-checking equations', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'generated', 'ts-ast', 'kind-checking', 'dispatch.ts'), 'utf-8',
    );
    expect(content).toContain("from '../../../specs/ts-ast/kind-checking/equations.js'");
  });
});
