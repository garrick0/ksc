/**
 * Composition root for the check command.
 *
 * Wires the evaluation path: imports the pre-composed checkProject from the
 * application barrel and injects it into the pure check command handler.
 *
 * Only loaded when `ksc check` runs — `ksc codegen` never touches this module,
 * so codegen adapters are never pulled in during a check.
 */

import type { ParsedArgs } from '../args.js';
import { checkProject } from '../../../src/application/index.js';
import { checkCommand } from '../commands/check.js';

export function runCheck(opts: ParsedArgs): Promise<number> {
  return checkCommand(opts, { checkProject });
}
