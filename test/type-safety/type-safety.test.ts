/**
 * Type-level regression tests for the three-layer kind safety system.
 *
 * Verifies that TypeScript's type checker catches invalid kind references
 * at the spec level (Layer 1) by running tsc on intentionally-broken files.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_ROOT = join(import.meta.dirname!, '../..');
const TMP_DIR = join(PROJECT_ROOT, '.type-test-tmp');

function runTsc(filename: string, code: string): { success: boolean; stderr: string } {
  mkdirSync(TMP_DIR, { recursive: true });
  const filePath = join(TMP_DIR, filename);
  writeFileSync(filePath, code);
  try {
    execSync(`npx tsc --noEmit --strict --moduleResolution Node16 --module Node16 --target ES2022 --skipLibCheck ${filePath}`, {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, stderr: '' };
  } catch (err: any) {
    return { success: false, stderr: err.stderr || err.stdout || '' };
  }
}

function cleanup() {
  try { rmSync(TMP_DIR, { recursive: true, force: true }); } catch {}
}

// Paths relative from .type-test-tmp/ to project modules
const TYPES_PATH = '../analysis/index.js';
const EQUATION_UTILS_PATH = '../analysis/equation-utils.js';

describe('type-level kind safety (Layer 1)', () => {
  afterAll(cleanup);

  it('rejects invalid kind in syn equations', () => {
    const code = `
import type { SynAttr } from '${TYPES_PATH}';
import { withDeps } from '${EQUATION_UTILS_PATH}';

type TestKind = 'Alpha' | 'Beta';

const eq = withDeps([], function eq_test() { return 'x'; });
const attr: SynAttr<TestKind> = {
  name: 'test',
  direction: 'syn',
  type: 'string',
  default: null,
  equations: { Bogus: eq },
};
`;
    const result = runTsc('invalid-syn-kind.ts', code);
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('Bogus');
  });

  it('rejects invalid kind in inh parentEquations', () => {
    const code = `
import type { InhAttr } from '${TYPES_PATH}';
import { withDeps } from '${EQUATION_UTILS_PATH}';

type TestKind = 'Alpha' | 'Beta';

const eq = withDeps([], function eq_test() { return undefined; });
const attr: InhAttr<TestKind> = {
  name: 'test',
  direction: 'inh',
  type: 'string | null',
  rootValue: null,
  parentEquations: { Invalid: eq },
};
`;
    const result = runTsc('invalid-inh-kind.ts', code);
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('Invalid');
  });

  it('accepts valid kind refs', () => {
    const code = `
import type { SynAttr } from '${TYPES_PATH}';
import { withDeps } from '${EQUATION_UTILS_PATH}';

type TestKind = 'Alpha' | 'Beta';

const eq = withDeps([], function eq_test() { return 'x'; });
const attr: SynAttr<TestKind> = {
  name: 'test',
  direction: 'syn',
  type: 'string',
  default: null,
  equations: { Alpha: eq },
};
`;
    const result = runTsc('valid-kind.ts', code);
    expect(result.success).toBe(true);
  });

  it('accepts untyped specs (K = string)', () => {
    const code = `
import type { SynAttr } from '${TYPES_PATH}';
import { withDeps } from '${EQUATION_UTILS_PATH}';

const eq = withDeps([], function eq_test() { return 'x'; });
const attr: SynAttr = {
  name: 'test',
  direction: 'syn',
  type: 'string',
  default: null,
  equations: { AnythingGoes: eq },
};
`;
    const result = runTsc('untyped-kind.ts', code);
    expect(result.success).toBe(true);
  });
});
