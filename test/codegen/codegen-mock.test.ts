/**
 * Tests for the mock analysis composition root.
 *
 * Verifies that the analysis codegen pipeline works with the mock grammar,
 * and that mock and ts-ast codegen don't interfere with each other.
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const ROOT = path.resolve(import.meta.dirname!, '../..');
const MOCK_OUT = path.join(ROOT, 'src', 'adapters', 'analysis', 'spec', 'mock', 'generated');

describe('mock composition root', () => {
  it('ksc codegen runs both targets successfully', () => {
    const output = execSync('npx tsx apps/cli/cli.ts codegen', {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 30000,
    });

    expect(output).toContain('Codegen: ts-kind-checking');
    expect(output).toContain('Codegen: mock');
    expect(output).toContain('All codegen targets complete.');
  });

  it('generates dispatch with mock spec import path', () => {
    const content = fs.readFileSync(path.join(MOCK_OUT, 'dispatch.ts'), 'utf-8');
    expect(content).toContain("from '../spec.js");
    expect(content).not.toContain('kind-checking');
  });

  it('generates attr-types with nodeCount attribute', () => {
    const content = fs.readFileSync(path.join(MOCK_OUT, 'attr-types.ts'), 'utf-8');
    expect(content).toContain('nodeCount');
    expect(content).not.toContain('kindDefs');
    expect(content).not.toContain('defEnv');
  });
});

describe('mock vs ts-ast isolation', () => {
  it('ts-ast dispatch still references kind-checking equations', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'src', 'adapters', 'analysis', 'spec', 'ts-kind-checking', 'generated', 'dispatch.ts'), 'utf-8',
    );
    expect(content).toContain("from '../equations/index.js'");
  });
});
