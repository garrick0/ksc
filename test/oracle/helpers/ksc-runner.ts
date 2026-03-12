/**
 * KindScript ESLint-equiv evaluator runner for oracle tests.
 *
 * Runs the eslint-equiv evaluator on a fixture directory, returning
 * normalised violations for comparison with ESLint output.
 */

import * as path from 'node:path';
import ts from 'typescript';
import { tsToAstTranslatorAdapter } from '../../../src/application/evaluation/ts-kind-checking.js';
import { evaluator } from '../../../src/application/evaluation/eslint-equiv.js';
import type { NormalisedViolation } from './types.js';
import type { EslintEquivDiagnostic } from '../../../src/adapters/analysis/spec/eslint-equiv/types.js';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

export function runKSC(
  fixture: string,
  kscRuleId: string,
): NormalisedViolation[] {
  const fixtureDir = path.join(FIXTURES_DIR, fixture, 'src');

  // Discover .ts files
  const files = ts.sys.readDirectory(fixtureDir, ['.ts']);
  if (files.length === 0) {
    throw new Error(`No .ts files found in ${fixtureDir}`);
  }

  // Create TS program + convert to KS tree
  const tsProgram = ts.createProgram(files, {
    strict: true,
    noEmit: true,
    rootDir: fixtureDir,
  });
  const { root } = tsToAstTranslatorAdapter.convert(tsProgram);

  // Evaluate using eslint-equiv evaluator
  const result = evaluator.evaluate(root);
  const allDiagnostics: EslintEquivDiagnostic[] = result.violations[kscRuleId] ?? [];

  // Build source file map for pos → line/column conversion
  const sourceFileMap = new Map<string, ts.SourceFile>();
  for (const file of files) {
    const sf = tsProgram.getSourceFile(file);
    if (sf) sourceFileMap.set(file, sf);
  }

  // Convert to normalised violations
  const violations: NormalisedViolation[] = [];
  for (const d of allDiagnostics) {
    const sf = sourceFileMap.get(d.fileName);
    if (!sf) continue;

    const { line, character } = sf.getLineAndCharacterOfPosition(d.pos);

    violations.push({
      file: path.relative(fixtureDir, d.fileName),
      line: line + 1,  // ts is 0-based; normalise to 1-based
      column: character,  // already 0-based
      ruleId: d.ruleId,
    });
  }

  return violations;
}
