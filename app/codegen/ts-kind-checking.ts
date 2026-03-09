/**
 * Composition root: TS AST grammar + kind-checking analysis.
 *
 * Wires the TypeScript AST grammar and kind-checking analysis
 * to the shared codegen pipeline.
 *
 * Usage:
 *   npx tsx app/codegen/ts-kind-checking.ts           # all
 *   npx tsx app/codegen/ts-kind-checking.ts grammar   # grammar only
 *   npx tsx app/codegen/ts-kind-checking.ts analysis  # analysis only
 *   npx tsx app/codegen/ts-kind-checking.ts verify    # grammar verification
 */

import * as path from 'path';
import { fileURLToPath } from 'url';

import { createGrammarBuilder } from '../../grammar/builder.js';
import { buildGrammarSpec } from '../../specs/ts-ast/grammar/spec.js';
import { verifyGrammar } from '../../specs/ts-ast/grammar/verify.js';
import { analysisSpec } from '../../specs/ts-ast/kind-checking/spec.js';
import { runCodegenCLI } from './lib/codegen.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '../..');

runCodegenCLI({
  callerFilePath: __filename,
  grammarOutputDir: path.join(ROOT, 'generated', 'ts-ast', 'grammar'),
  analysisOutputDir: path.join(ROOT, 'generated', 'ts-ast', 'kind-checking'),
  grammarSpec: buildGrammarSpec(createGrammarBuilder()),
  analysisSpec,
  generatedImports: {
    specImportPath: '../../../specs/ts-ast/kind-checking/spec.js',
    grammarImportPath: '../grammar/index.js',
    analysisImportPath: '../../../analysis',
  },
  verifier: verifyGrammar,
});
