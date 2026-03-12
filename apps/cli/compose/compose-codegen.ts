/**
 * Composition root for the codegen command.
 *
 * Wires the codegen path: imports concrete codegen targets (which pull in
 * AnalysisDecl adapters and equation functions) and the codegen pipeline,
 * then injects them into the pure codegen command handler.
 *
 * Only loaded when `ksc codegen` runs — `ksc check` never touches this module,
 * so the heavy spec.ts / equation imports stay out of the evaluation path.
 */

import type { ParsedArgs } from '../args.js';
import { runAllCodegen } from '../../../src/application/codegen/run-all-codegen.js';
import { allTargets } from '../../../src/application/codegen/codegen-targets.js';
import { codegenCommand } from '../commands/codegen.js';

export function runCodegen(opts: ParsedArgs): Promise<number> {
  return codegenCommand(opts, { runAllCodegen, allTargets });
}
