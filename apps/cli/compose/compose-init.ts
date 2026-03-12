/**
 * Composition root for the init command.
 *
 * Lightweight — no heavy adapter dependencies. The init command only
 * writes a config scaffold, so there is nothing to compose.
 * This module exists for structural consistency with other commands.
 */

import type { ParsedArgs } from '../args.js';
import { initCommand } from '../commands/init.js';

export function runInit(opts: ParsedArgs): number {
  return initCommand(opts);
}
