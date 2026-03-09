/**
 * Tests for the mock grammar + analysis composition root.
 *
 * Verifies that the two-functor pipeline works with a second,
 * independent grammar and analysis specification.
 *
 * Runs the mock codegen as a subprocess to avoid registry conflicts
 * with the ts-ast grammar (which is loaded by other test files).
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const ROOT = path.resolve(import.meta.dirname!, '..');
const MOCK_OUT = path.join(ROOT, 'generated-mock');

describe('mock composition root', () => {
  it('runs codegen/mock.ts successfully as a subprocess', () => {
    // Run in a separate process to avoid registry conflicts
    const output = execSync('npx tsx app/codegen/mock.ts', {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 30000,
    });

    expect(output).toContain('Functor 1: Grammar Compilation');
    expect(output).toContain('Schema: 5 nodes, 2 sum types');
    expect(output).toContain('Cross-Functor Validation');
    expect(output).toContain('Functor 2: Analysis Compilation');
    expect(output).toContain('Done!');
  });

  it('generates grammar AST files', () => {
    const grammarDir = path.join(MOCK_OUT, 'mock', 'grammar');
    const files = fs.readdirSync(grammarDir);
    expect(files).toContain('node-types.ts');
    expect(files).toContain('schema.ts');
    expect(files).toContain('index.ts');
  });

  it('generated node-types contain mock nodes', () => {
    const content = fs.readFileSync(path.join(MOCK_OUT, 'mock', 'grammar', 'node-types.ts'), 'utf-8');
    expect(content).toContain('KSMockProgram');
    expect(content).toContain('KSMockBinaryExpression');
    expect(content).toContain('KSMockExpression');
    expect(content).toContain('KSMockStatement');
    // Should NOT contain ts-ast node types
    expect(content).not.toContain('KSSourceFile');
    expect(content).not.toContain('KSIfStatement');
  });

  it('generates evaluator with mock spec import path', () => {
    const content = fs.readFileSync(path.join(MOCK_OUT, 'mock', 'mock-analysis', 'evaluator.ts'), 'utf-8');
    expect(content).toContain("from '../../../specs/mock/mock-analysis/spec.js'");
    // Should NOT contain ts-ast spec path
    expect(content).not.toContain('kind-checking');
  });

  it('generates attr-types with nodeCount attribute', () => {
    const content = fs.readFileSync(path.join(MOCK_OUT, 'mock', 'mock-analysis', 'attr-types.ts'), 'utf-8');
    expect(content).toContain('nodeCount');
    // Should NOT contain ts-ast-specific attributes
    expect(content).not.toContain('kindDefs');
    expect(content).not.toContain('defEnv');
  });
});

describe('mock vs ts-ast isolation', () => {
  it('ts-ast codegen still works after mock codegen', () => {
    const output = execSync('npx tsx app/codegen/ts-kind-checking.ts', {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 30000,
    });

    expect(output).toContain('Schema: 364 nodes, 48 sum types');
    expect(output).toContain('Done!');
  });

  it('ts-ast evaluator still references kind-checking spec', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'generated', 'ts-ast', 'kind-checking', 'evaluator.ts'), 'utf-8',
    );
    expect(content).toContain("from '../../../specs/ts-ast/kind-checking/spec.js'");
  });
});
