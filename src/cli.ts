#!/usr/bin/env node
/**
 * KindScript CLI.
 *
 * Usage:
 *   ksc check                         # Use kindscript.config.ts in cwd
 *   ksc check --config path/to/cfg.ts # Explicit config path
 *   ksc check --json                  # Output diagnostics as JSON
 */

import ts from 'typescript';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { createProgram } from './program.js';
import type { KindScriptConfig } from './config.js';
import type { KSDiagnostic } from './types.js';

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
  // Use dynamic import — works for both .ts (via tsx/ts-node) and .js
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

// ── Diagnostic formatting ────────────────────────────────────────────

function formatDiagnostic(d: KSDiagnostic, rootDir: string): string {
  const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
  const relPath = path.relative(rootDir, d.file.fileName);
  const severity = d.category === ts.DiagnosticCategory.Error ? 'error' : 'warning';
  return `${relPath}(${line + 1},${character + 1}): ${severity} KS${d.code}: ${d.messageText}`;
}

// ── Commands ─────────────────────────────────────────────────────────

async function runCheck(opts: CLIOptions): Promise<number> {
  // Resolve config
  const configPath = opts.configPath
    ? path.resolve(opts.configPath)
    : findConfig(opts.rootDir);

  if (!configPath) {
    console.error('Error: No config file found. Create kindscript.config.ts or use --config.');
    return 1;
  }

  if (!fs.existsSync(configPath)) {
    console.error(`Error: Config file not found: ${configPath}`);
    return 1;
  }

  const config = await loadConfig(configPath);

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

  const diagnostics = program.getKindDiagnostics();

  // Output
  if (opts.json) {
    const output = diagnostics.map(d => {
      const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
      return {
        file: path.relative(opts.rootDir, d.file.fileName),
        line: line + 1,
        column: character + 1,
        code: d.code,
        property: d.property,
        message: d.messageText,
      };
    });
    console.log(JSON.stringify(output, null, 2));
  } else {
    if (diagnostics.length === 0) {
      console.log(`\nksc: ${rootFiles.length} files checked, no violations found.\n`);
    } else {
      console.log('');
      for (const d of diagnostics) {
        console.log(formatDiagnostic(d, opts.rootDir));
      }
      console.log(`\nksc: ${diagnostics.length} violation${diagnostics.length === 1 ? '' : 's'} found in ${rootFiles.length} files.\n`);
    }
  }

  return diagnostics.length > 0 ? 1 : 0;
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

Config files (auto-detected):
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
