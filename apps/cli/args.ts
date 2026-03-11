/**
 * CLI argument parsing — converts process.argv into a typed ParsedArgs object.
 */

import { parseArgs } from 'node:util';
import { parseAnalysisDepth } from '../../src/api.js';
import type { AnalysisDepth } from '../../src/api.js';
import { CLIError } from './errors.js';

export type { AnalysisDepth } from '../../src/api.js';

// ── Types ────────────────────────────────────────────────────────────

export interface ParsedArgs {
  command: string;
  /** Explicit config path from --config, or undefined if not set. */
  configPath: string | undefined;
  json: boolean;
  /** undefined means not explicitly set — config value or default ('check') will apply. */
  depth: AnalysisDepth | undefined;
  rootDir: string;
  help: boolean;
  version: boolean;
}

// ── Parsing ──────────────────────────────────────────────────────────

function validateDepth(value: string): AnalysisDepth {
  try {
    return parseAnalysisDepth(value);
  } catch {
    throw new CLIError(`Invalid --depth value '${value}'. Must be parse, bind, or check.`);
  }
}

export function parseArgv(argv: string[]): ParsedArgs {
  const { values, positionals } = parseArgs({
    args: argv.slice(2),
    options: {
      config: { type: 'string' },
      json: { type: 'boolean', default: false },
      depth: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
    allowPositionals: true,
    strict: true,
  });

  const command = positionals[0] ?? 'check';
  const depth = values.depth !== undefined ? validateDepth(values.depth) : undefined;

  return {
    command,
    configPath: values.config,
    json: values.json ?? false,
    depth,
    rootDir: process.cwd(),
    help: values.help ?? false,
    version: values.version ?? false,
  };
}
