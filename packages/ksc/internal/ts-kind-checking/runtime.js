import { createTSASTGrammar } from '../../../../libs/languages/ts-ast/src/grammar/index.ts';
import { convertTSAST } from '../../../../libs/languages/ts-ast/src/translator/convert.ts';
import { createRuntime } from '../../../../libs/analyses/ts-kind-checking/src/index.ts';

export const grammar = createTSASTGrammar();
export const translator = { convert: convertTSAST };

export { createRuntime };
