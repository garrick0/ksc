/**
 * KindScript CLI — composition root.
 *
 * Wires command handlers into the dispatch registry and provides main().
 * This is the only file that knows which commands exist.
 */

import { dispatch } from './dispatch.js';
import { checkCommand } from './commands/check.js';
import { codegenCommand } from './commands/codegen.js';
import { initCommand } from './commands/init.js';

// Re-export for tests and consumers
export { parseArgv } from './args.js';
export type { ParsedArgs } from './args.js';
export { CLIError, EXIT_SUCCESS, EXIT_VIOLATIONS, EXIT_ERROR } from './errors.js';

// ── Help text ────────────────────────────────────────────────────────

const HELP_TEXT = `
KindScript — Architectural enforcement for TypeScript

Usage:
  ksc check                             Check the project
  ksc check --config <path>             Use a specific config file
  ksc check --json                      Output diagnostics as JSON
  ksc check --depth <parse|bind|check>  Analysis depth (default: check)
  ksc codegen                           Run analysis codegen (all targets)
  ksc init                              Generate a ksc.config.ts scaffold

Exit codes:
  0  No violations
  1  Violations found
  2  Error

Kind definitions are types in your source code:
  type Pure = Kind<{ noIO: true; noMutation: true }>;

Config files (optional, auto-detected):
  kindscript.config.ts, kindscript.config.js
  ksc.config.ts, ksc.config.js
`;

// ── Main ─────────────────────────────────────────────────────────────

export async function main(argv: string[] = process.argv): Promise<number> {
  return dispatch(argv, {
    handlers: {
      check: checkCommand,
      codegen: codegenCommand,
      init: initCommand,
    },
    helpText: HELP_TEXT,
  });
}
