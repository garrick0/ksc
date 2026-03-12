/**
 * Generic CLI dispatch — parses args, handles global flags, routes to commands.
 *
 * This module has no knowledge of specific commands or their dependencies.
 * It receives a command registry from the composition root (cli.ts) where
 * each command is a lazy loader — a function that dynamically imports the
 * command's composition root and returns the handler. This ensures that
 * only the adapter tree for the invoked command is loaded.
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { parseArgv } from './args.js';
import type { ParsedArgs } from './args.js';
import { CLIError, EXIT_SUCCESS, EXIT_ERROR } from './errors.js';

// ── Types ────────────────────────────────────────────────────────────

export type CommandHandler = (opts: ParsedArgs) => Promise<number> | number;
export type CommandLoader = () => Promise<CommandHandler>;

export interface CommandRegistry {
  loaders: Record<string, CommandLoader>;
  helpText: string;
}

// ── Dispatch ─────────────────────────────────────────────────────────

export async function dispatch(argv: string[], registry: CommandRegistry): Promise<number> {
  let opts: ParsedArgs;
  try {
    opts = parseArgv(argv);
  } catch (err) {
    if (err instanceof CLIError) {
      console.error(`Error: ${err.message}`);
      return EXIT_ERROR;
    }
    // parseArgs throws TypeError for unknown flags
    if (err instanceof TypeError) {
      console.error(`Error: ${err.message}`);
      console.error('Run "ksc --help" for usage.');
      return EXIT_ERROR;
    }
    throw err;
  }

  // Global flags
  if (opts.help || opts.command === 'help') {
    console.log(registry.helpText);
    return EXIT_SUCCESS;
  }

  if (opts.version) {
    const cliDir = path.dirname(new URL(import.meta.url).pathname);
    const pkgPath = path.resolve(cliDir, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    console.log(`ksc ${pkg.version}`);
    return EXIT_SUCCESS;
  }

  // Command dispatch — lazy-load the command's composition root
  const loader = registry.loaders[opts.command];
  if (!loader) {
    console.error(`Unknown command: ${opts.command}. Run "ksc --help" for usage.`);
    return EXIT_ERROR;
  }

  const handler = await loader();
  return handler(opts);
}
