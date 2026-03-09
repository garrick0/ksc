/**
 * Composition root: mock grammar + mock analysis.
 *
 * Demonstrates the separate composition root pattern with a
 * minimal grammar and analysis. Used for testing/verification
 * that the two-functor pipeline works with multiple data implementations.
 *
 * Usage:
 *   npx tsx app/codegen/mock.ts           # all (grammar + validate + analysis)
 *   npx tsx app/codegen/mock.ts grammar   # grammar only
 *   npx tsx app/codegen/mock.ts analysis  # analysis only
 */

import * as path from 'path';
import { fileURLToPath } from 'url';

import { createGrammarBuilder } from '../../grammar/builder.js';
import { buildGrammarSpec } from '../../specs/mock/grammar/spec.js';
import { analysisSpec } from '../../specs/mock/mock-analysis/spec.js';
import { runCodegenCLI } from './lib/codegen.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '../..');

runCodegenCLI({
  callerFilePath: __filename,
  grammarOutputDir: path.join(ROOT, 'generated-mock', 'mock', 'grammar'),
  analysisOutputDir: path.join(ROOT, 'generated-mock', 'mock', 'mock-analysis'),
  grammarSpec: buildGrammarSpec(createGrammarBuilder()),
  analysisSpec,
  generatedImports: {
    specImportPath: '../../../specs/mock/mock-analysis/spec.js',
    grammarImportPath: '../grammar/index.js',
    analysisImportPath: '../../../analysis',
  },
});
