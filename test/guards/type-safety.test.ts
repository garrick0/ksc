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
const TYPECHECK_TIMEOUT_MS = 30000;

function runTsc(filename: string, code: string): { success: boolean; stderr: string } {
  mkdirSync(TMP_DIR, { recursive: true });
  // Create a sub-folder for this test to isolate its tsconfig/source
  const testId = filename.replace('.ts', '');
  const testDir = join(TMP_DIR, testId);
  mkdirSync(testDir, { recursive: true });

  const filePath = join(testDir, 'test.ts');
  writeFileSync(filePath, code);

  // Write a tsconfig that extends root and resolves @ksc/* relative to PROJECT_ROOT
  const tsconfig = {
    extends: '../../tsconfig.json',
    compilerOptions: {
      baseUrl: '../..',
      noEmit: true,
      skipLibCheck: true,
    },
    files: ['test.ts'],
    include: [],
  };
  writeFileSync(join(testDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));

  try {
    execSync(`npx tsc -p ${testDir}`, {
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

// Import paths using aliases defined in root tsconfig.json
const TYPES_PATH = '@ksc/behavior';
const EQUATION_UTILS_PATH = '@ksc/behavior';

describe('type-level kind safety (Layer 1)', () => {
  afterAll(cleanup);

  it('rejects invalid kind in syn equations', { timeout: TYPECHECK_TIMEOUT_MS }, () => {
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

  it('rejects invalid kind in inh parentEquations', { timeout: TYPECHECK_TIMEOUT_MS }, () => {
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

  it('accepts valid kind refs', { timeout: TYPECHECK_TIMEOUT_MS }, () => {
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

  it('rejects wrong ctx type in TypedEquationMap', { timeout: TYPECHECK_TIMEOUT_MS }, () => {
    const code = `
import type { TypedEquationMap } from '${TYPES_PATH}';
import { withDeps } from '${EQUATION_UTILS_PATH}';

type TestKind = 'Alpha' | 'Beta';
interface AlphaNode { kind: 'Alpha'; value: string; pos: number; end: number; text: string; }
interface BetaNode { kind: 'Beta'; count: number; pos: number; end: number; text: string; }
type CtxMap = { Alpha: { node: AlphaNode }; Beta: { node: BetaNode } };

// This function expects AlphaNode context
const alphaEq = withDeps([], function alphaEq(ctx: { node: AlphaNode }): string {
  return ctx.node.value;
});

// Assigning alphaEq to Beta should fail — AlphaNode ctx is incompatible with BetaNode ctx
const bad: TypedEquationMap<TestKind, CtxMap, string> = { Beta: alphaEq };
`;
    const result = runTsc('typed-eq-map-wrong-ctx.ts', code);
    expect(result.success).toBe(false);
  });

  it('accepts correct ctx type in TypedEquationMap', { timeout: TYPECHECK_TIMEOUT_MS }, () => {
    const code = `
import type { TypedEquationMap } from '${TYPES_PATH}';
import { withDeps } from '${EQUATION_UTILS_PATH}';

type TestKind = 'Alpha' | 'Beta';
interface AlphaNode { kind: 'Alpha'; value: string; pos: number; end: number; text: string; }
interface BetaNode { kind: 'Beta'; count: number; pos: number; end: number; text: string; }
type CtxMap = { Alpha: { node: AlphaNode }; Beta: { node: BetaNode } };

const alphaEq = withDeps([], function alphaEq(ctx: { node: AlphaNode }): string {
  return ctx.node.value;
});

// Assigning alphaEq to Alpha should succeed — correct ctx type
const good: TypedEquationMap<TestKind, CtxMap, string> = { Alpha: alphaEq };
`;
    const result = runTsc('typed-eq-map-correct-ctx.ts', code);
    expect(result.success).toBe(true);
  });

  it('accepts untyped specs (K = string)', { timeout: TYPECHECK_TIMEOUT_MS }, () => {
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
