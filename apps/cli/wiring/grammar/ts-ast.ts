/**
 * CLI Composition Root: Grammar & Translator for TS AST.
 *
 * This module instantiates the concrete adapter singletons used by the CLI.
 * Following Clean Architecture, these singletons live in the app layer (apps/cli),
 * not in the library (src/).
 */

import ts from 'typescript';
import { createTSASTGrammar } from '@ksc/language-ts-ast/grammar/index.js';
import { convertTSAST } from '@ksc/language-ts-ast/translator/convert.js';
import type { KSProgram } from '@ksc/language-ts-ast/grammar/index.js';
import type { AstTranslatorPort } from '@ksc/grammar/index.js';
import type { AnalysisDepth } from '@ksc/types';

/** Singleton grammar instance for the TS AST. */
export const grammar = createTSASTGrammar();

/** Singleton translator adapter for TS AST → KS AST. */
export const tsToAstTranslatorAdapter: AstTranslatorPort<ts.Program, KSProgram, AnalysisDepth> = {
  convert: convertTSAST,
};
