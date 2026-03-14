/**
 * KindScript CLI — top-level composition root.
 *
 * Registers lazy command loaders and delegates to the generic dispatch.
 * Each command has its own composition root that is only loaded when
 * that command is invoked. This means `ksc check` never loads codegen
 * adapters, and `ksc codegen` never creates the evaluator.
 */

import { dispatch } from './harness/dispatch.js';

// Re-export for tests and consumers
export { parseArgv } from './harness/args.js';
export type { ParsedArgs } from './harness/args.js';
export { CLIError, EXIT_SUCCESS, EXIT_VIOLATIONS, EXIT_ERROR } from './harness/errors.js';

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
  ksc.config.ts, ksc.config.js
`;

// ── Main ─────────────────────────────────────────────────────────────

export async function main(argv: string[] = process.argv): Promise<number> {
  return dispatch(argv, {
    loaders: {
      check:   () => import('./commands/check.js').then(m => m.checkCommand),
      codegen: () => import('./commands/codegen.js').then(m => m.codegenCommand),
      init:    () => import('./commands/init.js').then(m => m.initCommand),
    },
    helpText: HELP_TEXT,
  });
}
