/**
 * Oracle tests — validate KindScript eslint-equiv analysis against ESLint.
 *
 * For each rule, runs both ESLint and KindScript on the same fixture files
 * and asserts that they produce identical normalised violation sets.
 *
 * Phase 1: Group A — 6 trivial syn rules.
 * Phase 2: Group B — 5 child-inspection syn rules.
 * Phase 3: Group C — 1 inherited + syn rule (max-depth).
 * Phase 5: Group E — 2 TS-specific syn rules.
 */

import { describe, it, expect } from 'vitest';
import { runESLint } from './helpers/eslint-runner.js';
import { runKSC } from './helpers/ksc-runner.js';
import { sortViolations } from './helpers/normalise.js';
import type { OracleRule } from './helpers/types.js';

// ── Oracle rule definitions ──────────────────────────────────────────

const ORACLE_RULES: OracleRule[] = [
  // ── Group A — trivial syn ──
  {
    eslintRuleId: 'eqeqeq',
    kscRuleId: 'eqeqeq',
    fixture: 'eqeqeq',
  },
  {
    eslintRuleId: 'no-var',
    kscRuleId: 'no-var',
    fixture: 'no-var',
  },
  {
    eslintRuleId: 'no-debugger',
    kscRuleId: 'no-debugger',
    fixture: 'no-debugger',
  },
  {
    eslintRuleId: 'no-empty',
    kscRuleId: 'no-empty',
    fixture: 'no-empty',
  },
  {
    eslintRuleId: 'no-bitwise',
    kscRuleId: 'no-bitwise',
    fixture: 'no-bitwise',
  },
  {
    eslintRuleId: '@typescript-eslint/no-explicit-any',
    kscRuleId: '@typescript-eslint/no-explicit-any',
    fixture: 'no-explicit-any',
  },

  // ── Group B — child inspection ──
  {
    eslintRuleId: 'no-dupe-keys',
    kscRuleId: 'no-dupe-keys',
    fixture: 'no-dupe-keys',
  },
  {
    eslintRuleId: 'no-self-compare',
    kscRuleId: 'no-self-compare',
    fixture: 'no-self-compare',
  },
  {
    eslintRuleId: 'max-params',
    kscRuleId: 'max-params',
    fixture: 'max-params',
    eslintConfig: ['error', { max: 3 }],
  },
  {
    eslintRuleId: '@typescript-eslint/no-empty-interface',
    kscRuleId: '@typescript-eslint/no-empty-interface',
    fixture: 'no-empty-interface',
  },
  {
    eslintRuleId: 'no-duplicate-imports',
    kscRuleId: 'no-duplicate-imports',
    fixture: 'no-duplicate-imports',
  },

  // ── Group C — inherited (depth) ──
  {
    eslintRuleId: 'max-depth',
    kscRuleId: 'max-depth',
    fixture: 'max-depth',
    eslintConfig: ['error', { max: 4 }],
  },

  // ── Group E — TS-specific syn ──
  {
    eslintRuleId: '@typescript-eslint/array-type',
    kscRuleId: '@typescript-eslint/array-type',
    fixture: 'array-type',
  },
  {
    eslintRuleId: '@typescript-eslint/consistent-type-definitions',
    kscRuleId: '@typescript-eslint/consistent-type-definitions',
    fixture: 'consistent-type-definitions',
  },

  // ── Phase 6 — more syn rules ──
  {
    eslintRuleId: 'no-console',
    kscRuleId: 'no-console',
    fixture: 'no-console',
  },
  {
    eslintRuleId: 'no-eval',
    kscRuleId: 'no-eval',
    fixture: 'no-eval',
  },
  {
    eslintRuleId: 'no-new-wrappers',
    kscRuleId: 'no-new-wrappers',
    fixture: 'no-new-wrappers',
  },
  {
    eslintRuleId: 'no-plusplus',
    kscRuleId: 'no-plusplus',
    fixture: 'no-plusplus',
  },
  {
    eslintRuleId: 'no-template-curly-in-string',
    kscRuleId: 'no-template-curly-in-string',
    fixture: 'no-template-curly-in-string',
  },
  {
    eslintRuleId: 'no-cond-assign',
    kscRuleId: 'no-cond-assign',
    fixture: 'no-cond-assign',
  },
  {
    eslintRuleId: 'no-duplicate-case',
    kscRuleId: 'no-duplicate-case',
    fixture: 'no-duplicate-case',
  },
  {
    eslintRuleId: 'no-self-assign',
    kscRuleId: 'no-self-assign',
    fixture: 'no-self-assign',
  },
  {
    eslintRuleId: 'default-case',
    kscRuleId: 'default-case',
    fixture: 'default-case',
  },
  {
    eslintRuleId: 'default-case-last',
    kscRuleId: 'default-case-last',
    fixture: 'default-case-last',
  },
  {
    eslintRuleId: 'no-useless-catch',
    kscRuleId: 'no-useless-catch',
    fixture: 'no-useless-catch',
  },
  {
    eslintRuleId: 'no-multi-assign',
    kscRuleId: 'no-multi-assign',
    fixture: 'no-multi-assign',
  },
  {
    eslintRuleId: 'yoda',
    kscRuleId: 'yoda',
    fixture: 'yoda',
  },
  {
    eslintRuleId: 'no-empty-function',
    kscRuleId: 'no-empty-function',
    fixture: 'no-empty-function',
  },
  {
    eslintRuleId: 'use-isnan',
    kscRuleId: 'use-isnan',
    fixture: 'use-isnan',
  },
  {
    eslintRuleId: 'no-sparse-arrays',
    kscRuleId: 'no-sparse-arrays',
    fixture: 'no-sparse-arrays',
  },
  {
    eslintRuleId: 'no-empty-pattern',
    kscRuleId: 'no-empty-pattern',
    fixture: 'no-empty-pattern',
  },

  // ── Phase 7 — more TS-specific syn ──
  {
    eslintRuleId: '@typescript-eslint/no-non-null-assertion',
    kscRuleId: '@typescript-eslint/no-non-null-assertion',
    fixture: 'no-non-null-assertion',
  },
  {
    eslintRuleId: '@typescript-eslint/no-namespace',
    kscRuleId: '@typescript-eslint/no-namespace',
    fixture: 'no-namespace',
  },
  {
    eslintRuleId: '@typescript-eslint/no-require-imports',
    kscRuleId: '@typescript-eslint/no-require-imports',
    fixture: 'no-require-imports',
  },
  {
    eslintRuleId: '@typescript-eslint/no-empty-object-type',
    kscRuleId: '@typescript-eslint/no-empty-object-type',
    fixture: 'no-empty-object-type',
  },
  {
    eslintRuleId: '@typescript-eslint/consistent-type-assertions',
    kscRuleId: '@typescript-eslint/consistent-type-assertions',
    fixture: 'consistent-type-assertions',
  },
  {
    eslintRuleId: '@typescript-eslint/no-duplicate-enum-values',
    kscRuleId: '@typescript-eslint/no-duplicate-enum-values',
    fixture: 'no-duplicate-enum-values',
  },
  {
    eslintRuleId: '@typescript-eslint/prefer-as-const',
    kscRuleId: '@typescript-eslint/prefer-as-const',
    fixture: 'prefer-as-const',
  },

  // ── Phase 8 — class structure ──
  {
    eslintRuleId: 'no-dupe-class-members',
    kscRuleId: 'no-dupe-class-members',
    fixture: 'no-dupe-class-members',
  },
  {
    eslintRuleId: 'no-useless-constructor',
    kscRuleId: 'no-useless-constructor',
    fixture: 'no-useless-constructor',
  },
  {
    eslintRuleId: 'no-empty-static-block',
    kscRuleId: 'no-empty-static-block',
    fixture: 'no-empty-static-block',
  },

  // ── Scope — inherited scope threading ──
  {
    eslintRuleId: 'no-shadow',
    kscRuleId: 'no-shadow',
    fixture: 'no-shadow',
  },

  // ── Control flow ──
  {
    eslintRuleId: 'no-unreachable',
    kscRuleId: 'no-unreachable',
    fixture: 'no-unreachable',
  },
  {
    eslintRuleId: 'no-fallthrough',
    kscRuleId: 'no-fallthrough',
    fixture: 'no-fallthrough',
  },

  // ── Complexity ──
  {
    eslintRuleId: 'complexity',
    kscRuleId: 'complexity',
    fixture: 'complexity',
    eslintConfig: ['error', 2],
  },
];

// ── Parameterised tests ──────────────────────────────────────────────

describe('oracle — ESLint vs KindScript eslint-equiv', { timeout: 60_000, concurrent: true }, () => {
  for (const rule of ORACLE_RULES) {
    it(`${rule.eslintRuleId}: count, locations, and clean files match`, async () => {
      const eslintResults = await runESLint(
        rule.fixture, rule.eslintRuleId, rule.eslintConfig,
      );
      const kscResults = runKSC(rule.fixture, rule.kscRuleId);

      // Count matches
      expect(kscResults.length).toBe(eslintResults.length);

      // Locations match
      const eslintFileLines = sortViolations(eslintResults).map(v => `${v.file}:${v.line}`);
      const kscFileLines = sortViolations(kscResults).map(v => `${v.file}:${v.line}`);
      expect(kscFileLines).toEqual(eslintFileLines);

      // Clean files produce zero violations
      expect(eslintResults.filter(v => v.file.includes('clean'))).toEqual([]);
      expect(kscResults.filter(v => v.file.includes('clean'))).toEqual([]);
    });
  }
});
