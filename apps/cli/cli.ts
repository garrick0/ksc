/**
 * KindScript CLI — top-level composition root.
 *
 * Registers lazy command loaders and delegates to the generic dispatch.
 * Each command has its own composition root in compose/ that is only
 * loaded when that command is invoked. This means `ksc check` never
 * loads codegen adapters, and `ksc codegen` never creates the evaluator.
 *
 * Composition root tree:
 *   cli.ts (this file)
 *     ├── compose/compose-check.ts   → evaluation path
 *     ├── compose/compose-codegen.ts → codegen path
 *     └── compose/compose-init.ts    → lightweight (no adapters)
 */

import { dispatch } from './dispatch.js';

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
    loaders: {
      check:   () => import('./compose/compose-check.js').then(m => m.runCheck),
      codegen: () => import('./compose/compose-codegen.js').then(m => m.runCodegen),
      init:    () => import('./compose/compose-init.js').then(m => m.runInit),
    },
    helpText: HELP_TEXT,
  });
}
