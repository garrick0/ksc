/**
 * Test composition helpers.
 */

import { createTSASTGrammar } from '@ksc/language-ts-ast/grammar/index.js';
import { createMockGrammar } from '@ksc/language-mock/grammar/index.js';
import { convertTSAST } from '@ksc/language-ts-ast/translator/convert.js';
import { buildTree, evaluate } from '@ksc/evaluation/index.js';
import { runtime as tsRuntime, createRuntime as createTSKindCheckingRuntime } from '@ksc/analysis-ts-kind-checking';
import { runtime as eslintRuntime } from '@ksc/analysis-eslint-equiv';
import { runtime as mockRuntime } from '@ksc/analysis-mock';
import type { KSCAttrMap as TSKindAttrMap } from '@ksc/analysis-ts-kind-checking';
import type { KSCAttrMap as EslintAttrMap } from '@ksc/analysis-eslint-equiv';
import type { KSCAttrMap as MockAttrMap } from '@ksc/analysis-mock';
import type { ASTNode } from '@ksc/grammar/index.js';
import type { KindScriptConfig } from '@ksc/user-config';

export const tsGrammar = createTSASTGrammar();
export const mockGrammar = createMockGrammar();

export const tsToAstTranslatorAdapter = {
  convert: convertTSAST,
};

export function evaluateTS(root: ASTNode, config?: KindScriptConfig) {
  const runtime = config ? createTSKindCheckingRuntime(config) : tsRuntime;
  return evaluate<TSKindAttrMap>({
    grammar: tsGrammar,
    dispatch: runtime.dispatch,
    root,
  });
}

export function buildTSTree(root: ASTNode) {
  return buildTree<TSKindAttrMap>({
    grammar: tsGrammar,
    dispatch: tsRuntime.dispatch,
    root,
  });
}

export function evaluateEslint(root: ASTNode) {
  return evaluate<EslintAttrMap>({
    grammar: tsGrammar,
    dispatch: eslintRuntime.dispatch,
    setup: eslintRuntime.setup,
    root,
  });
}

export function buildEslintTree(root: ASTNode) {
  return buildTree<EslintAttrMap>({
    grammar: tsGrammar,
    dispatch: eslintRuntime.dispatch,
    root,
  });
}

export function evaluateMock(root: ASTNode) {
  return evaluate<MockAttrMap>({
    grammar: mockGrammar,
    dispatch: mockRuntime.dispatch,
    setup: mockRuntime.setup,
    root,
  });
}

export function buildMockTree(root: ASTNode) {
  return buildTree<MockAttrMap>({
    grammar: mockGrammar,
    dispatch: mockRuntime.dispatch,
    root,
  });
}
