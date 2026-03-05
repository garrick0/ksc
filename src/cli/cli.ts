#!/usr/bin/env node
/**
 * KindScript CLI.
 *
 * Usage:
 *   ksc check                         # Check the project
 *   ksc check --config path/to/cfg.ts # Explicit config path
 *   ksc check --json                  # Output diagnostics as JSON
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { createProgram } from '../program.js';
import type { KindScriptConfig } from '../api/config.js';

// ── Argument parsing ─────────────────────────────────────────────────

interface CLIOptions {
  command: string;
  configPath: string;
  json: boolean;
  rootDir: string;
}

function parseArgv(argv: string[]): CLIOptions {
  const args = argv.slice(2);
  const command = args[0] ?? 'check';

  let configPath = '';
  let json = false;
  const rootDir = process.cwd();

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') {
      json = true;
    } else if (arg === '--config' && i + 1 < args.length) {
      configPath = args[++i];
    } else if (arg.startsWith('--config=')) {
      configPath = arg.slice('--config='.length);
    }
  }

  return { command, configPath, json, rootDir };
}

// ── Config discovery ─────────────────────────────────────────────────

const CONFIG_NAMES = [
  'kindscript.config.ts',
  'kindscript.config.js',
  'ksc.config.ts',
  'ksc.config.js',
];

function findConfig(rootDir: string): string | undefined {
  for (const name of CONFIG_NAMES) {
    const full = path.join(rootDir, name);
    if (fs.existsSync(full)) return full;
  }
  return undefined;
}

async function loadConfig(configPath: string): Promise<KindScriptConfig> {
  const abs = path.resolve(configPath);
  const mod = await import(abs);
  return mod.default ?? mod;
}

// ── File discovery ───────────────────────────────────────────────────

function findRootFiles(rootDir: string): string[] {
  const results: string[] = [];
  function walk(dir: string) {
    let entries: string[];
    try { entries = fs.readdirSync(dir); } catch { return; }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
      const full = path.join(dir, entry);
      try {
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walk(full);
        else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) results.push(full);
      } catch { /* skip */ }
    }
  }

  // Prefer src/ if it exists
  const srcDir = path.join(rootDir, 'src');
  if (fs.existsSync(srcDir)) {
    walk(srcDir);
    if (results.length > 0) return results;
  }

  walk(rootDir);
  return results;
}

// ── Commands ─────────────────────────────────────────────────────────

async function runCheck(opts: CLIOptions): Promise<number> {
  // Config is optional — only load if found
  let config: KindScriptConfig | undefined;
  const configPath = opts.configPath
    ? path.resolve(opts.configPath)
    : findConfig(opts.rootDir);

  if (configPath && fs.existsSync(configPath)) {
    config = await loadConfig(configPath);
  }

  // Discover root files
  const rootFiles = findRootFiles(opts.rootDir);
  if (rootFiles.length === 0) {
    console.error('Error: No TypeScript files found.');
    return 1;
  }

  // Create program and check
  const program = createProgram(rootFiles, config, {
    strict: true,
    noEmit: true,
    rootDir: opts.rootDir,
  });

  const definitions = program.getKindDefinitions();

  // Output
  if (opts.json) {
    console.log(JSON.stringify({ definitions: definitions.map(d => d.name) }, null, 2));
  } else {
    console.log(`\nksc: ${rootFiles.length} files checked, ${definitions.length} kinds found.\n`);
  }

  return 0;
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgv(process.argv);

  if (opts.command === 'check') {
    const exitCode = await runCheck(opts);
    process.exit(exitCode);
  } else if (opts.command === '--help' || opts.command === '-h' || opts.command === 'help') {
    console.log(`
KindScript — Architectural enforcement for TypeScript

Usage:
  ksc check                          Check the project
  ksc check --config <path>          Use a specific config file
  ksc check --json                   Output diagnostics as JSON

Kind definitions are types in your source code:
  type Pure = Kind<{ noIO: true; noMutation: true }>;

Config files (optional, auto-detected):
  kindscript.config.ts, kindscript.config.js
  ksc.config.ts, ksc.config.js
`);
    process.exit(0);
  } else if (opts.command === '--version' || opts.command === '-v' || opts.command === 'version') {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
    console.log(`ksc ${pkg.version}`);
    process.exit(0);
  } else {
    console.error(`Unknown command: ${opts.command}. Run "ksc --help" for usage.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`Error: ${err.message || err}`);
  process.exit(1);
});
