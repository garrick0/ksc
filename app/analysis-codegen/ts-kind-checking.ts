/**
 * Codegen composition root: kind-checking analysis over TypeScript AST.
 *
 * Wires adapters to ports:
 *   - Grammar adapter:  specs/ts-ast/grammar/     → Grammar<TSNodeKind>
 *   - Analysis adapter: specs/ts-ast/kind-checking/ → AnalysisSpec<TSNodeKind, KSCProjections>
 *   - Output:           → generated/ts-ast/kind-checking/
 *
 * Usage:
 *   npx tsx app/analysis-codegen/ts-kind-checking.ts
 */

import * as path from 'path';
import { fileURLToPath } from 'url';

// Adapters
import { grammar } from '../../specs/ts-ast/grammar/index.js';
import { analysisSpec } from '../../specs/ts-ast/kind-checking/spec.js';

// Composition root infrastructure
import { runCodegenCLI } from './lib/pipeline.js';
import type { CodegenTarget } from '../../analysis/index.js';
import type { TSNodeKind } from '../../specs/ts-ast/grammar/nodes.js';
import type { KSCProjections } from '../../specs/ts-ast/kind-checking/spec.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '../..');

/** Codegen target — grammar + spec paired via K = TSNodeKind. */
const target: CodegenTarget<TSNodeKind, KSCProjections> = {
  grammar,
  spec: analysisSpec,
  outputDir: path.join(ROOT, 'generated', 'ts-ast', 'kind-checking'),
  generatedImports: {
    specImportPath: '../../../specs/ts-ast/kind-checking/spec.js',
    grammarImportPath: '../../../specs/ts-ast/grammar/index.js',
    analysisImportPath: '../../../analysis',
    evaluatorImportPath: '../../../evaluator',
  },
};

runCodegenCLI({ ...target, callerFilePath: __filename });
