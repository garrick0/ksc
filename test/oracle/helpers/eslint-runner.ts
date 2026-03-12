/**
 * Programmatic ESLint runner for oracle tests.
 *
 * Runs ESLint with only the specified rule enabled on a fixture directory,
 * returning normalised violations.
 */

import * as path from 'node:path';
import { ESLint } from 'eslint';
import type { NormalisedViolation } from './types.js';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

export async function runESLint(
  fixture: string,
  eslintRuleId: string,
  eslintConfig: unknown = 'error',
): Promise<NormalisedViolation[]> {
  const fixtureDir = path.join(FIXTURES_DIR, fixture, 'src');

  const isTSPlugin = eslintRuleId.startsWith('@typescript-eslint/');

  // Build rule config
  const rules: Record<string, unknown> = {
    [eslintRuleId]: eslintConfig,
  };

  const config: Record<string, unknown> = {
    files: ['**/*.ts'],
    languageOptions: {
      parser: await import('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules,
  };

  if (isTSPlugin) {
    config.plugins = {
      '@typescript-eslint': (await import('@typescript-eslint/eslint-plugin')).default,
    };
  }

  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: config,
  });

  const results = await eslint.lintFiles(path.join(fixtureDir, '**/*.ts'));

  const violations: NormalisedViolation[] = [];
  for (const result of results) {
    const relFile = path.relative(fixtureDir, result.filePath);
    for (const msg of result.messages) {
      violations.push({
        file: relFile,
        line: msg.line,
        column: msg.column - 1,  // ESLint columns are 1-based; normalise to 0-based
        ruleId: eslintRuleId,
      });
    }
  }

  return violations;
}
