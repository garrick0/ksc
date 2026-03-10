/**
 * Codegen composition root: mock analysis (testing).
 *
 * Wires adapters to ports:
 *   - Grammar adapter:  specs/mock/grammar/        → Grammar<MockKind>
 *   - Analysis adapter: specs/mock/mock-analysis/   → AnalysisSpec<MockKind, MockProjections>
 *   - Output:           → generated-mock/mock/mock-analysis/
 *
 * Usage:
 *   npx tsx app/analysis-codegen/mock.ts
 */

import * as path from 'path';
import { fileURLToPath } from 'url';

// Adapters
import { grammar } from '../../specs/mock/grammar/index.js';
import { analysisSpec } from '../../specs/mock/mock-analysis/spec.js';

// Composition root infrastructure
import { runCodegenCLI } from './lib/pipeline.js';
import type { CodegenTarget } from '../../analysis/index.js';
import type { MockKind } from '../../specs/mock/grammar/nodes.js';
import type { MockProjections } from '../../specs/mock/mock-analysis/spec.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '../..');

/** Codegen target — grammar + spec paired via K = MockKind. */
const target: CodegenTarget<MockKind, MockProjections> = {
  grammar,
  spec: analysisSpec,
  outputDir: path.join(ROOT, 'generated-mock', 'mock', 'mock-analysis'),
  generatedImports: {
    specImportPath: '../../../specs/mock/mock-analysis/spec.js',
    grammarImportPath: '../../../specs/mock/grammar/index.js',
    analysisImportPath: '../../../analysis',
    evaluatorImportPath: '../../../evaluator',
  },
};

runCodegenCLI({ ...target, callerFilePath: __filename });
