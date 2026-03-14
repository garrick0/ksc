/**
 * Codegen target definitions — grammar/decl pairings for code generation.
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// TS AST adapters
import { grammar } from '../grammar/ts-ast.js';
import { analysisDecl as tsKindDecl } from '@ksc/analysis-ts-kind-checking';

// Mock adapters
import { grammar as mockGrammar } from '../grammar/mock.js';
import { analysisDecl as mockDecl } from '@ksc/analysis-mock';

// ESLint-equiv adapters
import { analysisDecl as eslintDecl } from '@ksc/analysis-eslint-equiv';

// Port types
import type { CodegenTarget } from '@ksc/behavior';
import type { TSNodeKind } from '@ksc/language-ts-ast/grammar/nodes.js';
import type { MockKind } from '@ksc/language-mock/grammar/nodes.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../');

/** TS AST kind-checking codegen target. */
export const tsKindCheckingTarget: CodegenTarget<TSNodeKind> = {
  grammar,
  decl: tsKindDecl,
  outputDir: path.join(ROOT, 'libs', 'analyses', 'ts-kind-checking', 'src', 'generated'),
  generatedImports: {
    specImportPath: '../spec.js',
    grammarImportPath: '@ksc/language-ts-ast/grammar/index.js',
    evaluatorImportPath: '@ksc/evaluation/index.js',
  },
};

/** Mock codegen target (testing). */
export const mockTarget: CodegenTarget<MockKind> = {
  grammar: mockGrammar,
  decl: mockDecl,
  outputDir: path.join(ROOT, 'libs', 'analyses', 'mock', 'src', 'generated'),
  generatedImports: {
    specImportPath: '../spec.js',
    equationsImportPath: '../spec.js',
    grammarImportPath: '@ksc/language-mock/grammar/index.js',
    evaluatorImportPath: '@ksc/evaluation/index.js',
  },
};

/** ESLint-equiv codegen target. */
export const eslintEquivTarget: CodegenTarget<TSNodeKind> = {
  grammar,
  decl: eslintDecl,
  outputDir: path.join(ROOT, 'libs', 'analyses', 'eslint-equiv', 'src', 'generated'),
  generatedImports: {
    specImportPath: '../spec.js',
    grammarImportPath: '@ksc/language-ts-ast/grammar/index.js',
    evaluatorImportPath: '@ksc/evaluation/index.js',
  },
};

/** All codegen targets, in execution order. */
export const allTargets = [
  { name: 'ts-kind-checking', target: tsKindCheckingTarget },
  { name: 'mock', target: mockTarget },
  { name: 'eslint-equiv', target: eslintEquivTarget },
];
