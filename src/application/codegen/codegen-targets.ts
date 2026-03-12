/**
 * Codegen target definitions — grammar/decl pairings for code generation.
 *
 * Each target bundles a grammar + analysis declaration + output configuration.
 * The K type parameter links grammar and decl, preventing mismatched pairings.
 *
 * Uses AnalysisDecl — codegen only needs attribute declarations and
 * type imports, not runtime projections (AnalysisProjections).
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// TS AST adapters
import { grammar } from '../../adapters/grammar/grammar/ts-ast/index.js';
import { analysisDecl } from '../../adapters/analysis/spec/ts-kind-checking/spec.js';

// Mock adapters
import { grammar as mockGrammar } from '../../adapters/grammar/grammar/mock/index.js';
import { analysisDecl as mockAnalysisDecl } from '../../adapters/analysis/spec/mock/spec.js';

// ESLint-equiv adapters
import { analysisDecl as eslintEquivDecl } from '../../adapters/analysis/spec/eslint-equiv/spec.js';

// Port types
import type { CodegenTarget } from '@kindscript/core-codegen';
import type { TSNodeKind } from '../../adapters/grammar/grammar/ts-ast/nodes.js';
import type { MockKind } from '../../adapters/grammar/grammar/mock/nodes.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** TS AST kind-checking codegen target. */
export const tsKindCheckingTarget: CodegenTarget<TSNodeKind> = {
  grammar,
  decl: analysisDecl,
  outputDir: path.join(ROOT, 'src', 'adapters', 'analysis', 'spec', 'ts-kind-checking', 'generated'),
  generatedImports: {
    specImportPath: '../spec.js',
    grammarImportPath: '../../../../grammar/grammar/ts-ast/index.js',
    analysisImportPath: '@kindscript/core-codegen',
    evaluatorImportPath: '@kindscript/core-evaluator',
  },
};

/** Mock codegen target (testing). */
export const mockTarget: CodegenTarget<MockKind> = {
  grammar: mockGrammar,
  decl: mockAnalysisDecl,
  outputDir: path.join(ROOT, 'src', 'adapters', 'analysis', 'spec', 'mock', 'generated'),
  generatedImports: {
    specImportPath: '../spec.js',
    grammarImportPath: '../../../../grammar/grammar/mock/index.js',
    analysisImportPath: '@kindscript/core-codegen',
    evaluatorImportPath: '@kindscript/core-evaluator',
  },
};

/** ESLint-equiv codegen target. */
export const eslintEquivTarget: CodegenTarget<TSNodeKind> = {
  grammar,
  decl: eslintEquivDecl,
  outputDir: path.join(ROOT, 'src', 'adapters', 'analysis', 'spec', 'eslint-equiv', 'generated'),
  generatedImports: {
    specImportPath: '../spec.js',
    grammarImportPath: '../../../../grammar/grammar/ts-ast/index.js',
    analysisImportPath: '@kindscript/core-codegen',
    evaluatorImportPath: '@kindscript/core-evaluator',
  },
};

/** All codegen targets, in execution order. */
export const allTargets = [
  { name: 'ts-kind-checking', target: tsKindCheckingTarget },
  { name: 'mock', target: mockTarget },
  { name: 'eslint-equiv', target: eslintEquivTarget },
];
