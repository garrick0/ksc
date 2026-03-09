#!/usr/bin/env node
/**
 * KindScript CLI.
 *
 * Usage:
 *   ksc check                         # Check the project
 *   ksc check --config path/to/cfg.ts # Explicit config path
 *   ksc check --json                  # Output diagnostics as JSON
 *   ksc check --depth parse|bind|check
 *   ksc check --watch                 # Re-check on file changes
 *   ksc init                          # Generate a config scaffold
 *
 * Exit codes:
 *   0 — success (no violations)
 *   1 — violations found
 *   2 — error (missing files, bad config, etc.)
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { createProgram } from './lib/program.js';
import type { KindScriptConfig } from './lib/config.js';

// ── Exit codes ────────────────────────────────────────────────────────

export const EXIT_SUCCESS = 0;
export const EXIT_VIOLATIONS = 1;
export const EXIT_ERROR = 2;

// ── Argument parsing ─────────────────────────────────────────────────

export interface CLIOptions {
  command: string;
  configPath: string;
  json: boolean;
  watch: boolean;
  depth: 'parse' | 'bind' | 'check';
  rootDir: string;
}

export function parseArgv(argv: string[]): CLIOptions {
  const args = argv.slice(2);
  const command = args[0] ?? 'check';

  let configPath = '';
  let json = false;
  let watch = false;
  let depth: 'parse' | 'bind' | 'check' = 'check';
  const rootDir = process.cwd();

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') {
      json = true;
    } else if (arg === '--watch' || arg === '-w') {
      watch = true;
    } else if (arg === '--config' && i + 1 < args.length) {
      configPath = args[++i];
    } else if (arg.startsWith('--config=')) {
      configPath = arg.slice('--config='.length);
    } else if (arg === '--depth' && i + 1 < args.length) {
      const val = args[++i];
      if (val === 'parse' || val === 'bind' || val === 'check') {
        depth = val;
      } else {
        console.error(`Error: invalid --depth value '${val}'. Must be parse, bind, or check.`);
        process.exit(EXIT_ERROR);
      }
    } else if (arg.startsWith('--depth=')) {
      const val = arg.slice('--depth='.length);
      if (val === 'parse' || val === 'bind' || val === 'check') {
        depth = val;
      } else {
        console.error(`Error: invalid --depth value '${val}'. Must be parse, bind, or check.`);
        process.exit(EXIT_ERROR);
      }
    }
  }

  return { command, configPath, json, watch, depth, rootDir };
}

// ── Config discovery ─────────────────────────────────────────────────

const CONFIG_NAMES = [
  'kindscript.config.ts',
  'kindscript.config.js',
  'ksc.config.ts',
  'ksc.config.js',
];

export function findConfig(rootDir: string): string | undefined {
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

export function findRootFiles(rootDir: string): string[] {
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

  // Apply CLI depth override
  if (!config) {
    config = { analysisDepth: opts.depth };
  } else if (opts.depth !== 'check') {
    config = { ...config, analysisDepth: opts.depth };
  }

  // Discover root files
  const rootFiles = findRootFiles(opts.rootDir);
  if (rootFiles.length === 0) {
    console.error('Error: No TypeScript files found.');
    console.error(`  Searched: ${opts.rootDir}`);
    console.error('  Hint: KSC looks for .ts files in src/ first, then the project root.');
    console.error('  Make sure your project has TypeScript source files, or use --config to specify paths.');
    return EXIT_ERROR;
  }

  // Create program and check
  const program = createProgram(rootFiles, config, {
    strict: true,
    noEmit: true,
    rootDir: opts.rootDir,
  });

  const definitions = program.getKindDefinitions();
  const diagnostics = program.getDiagnostics();

  // Output
  if (opts.json) {
    console.log(JSON.stringify({
      definitions: definitions.map(d => d.name),
      violations: diagnostics,
      fileCount: rootFiles.length,
    }, null, 2));
  } else {
    if (diagnostics.length > 0) {
      console.log('');
      for (const diag of diagnostics) {
        console.log(`  ${diag.message}`);
      }
      console.log('');
    }
    const status = diagnostics.length > 0
      ? `${diagnostics.length} violation${diagnostics.length === 1 ? '' : 's'} found`
      : 'no violations';
    console.log(`ksc: ${rootFiles.length} files, ${definitions.length} kinds, ${status}.`);
  }

  return diagnostics.length > 0 ? EXIT_VIOLATIONS : EXIT_SUCCESS;
}

function runInit(opts: CLIOptions): number {
  const configName = 'ksc.config.ts';
  const configPath = path.join(opts.rootDir, configName);

  if (fs.existsSync(configPath)) {
    console.error(`Error: ${configName} already exists.`);
    return EXIT_ERROR;
  }

  const template = `import { defineConfig } from 'kindscript';

export default defineConfig({
  analysisDepth: 'check',
});
`;

  fs.writeFileSync(configPath, template, 'utf-8');
  console.log(`Created ${configName}`);
  return EXIT_SUCCESS;
}

// ── Watch mode ───────────────────────────────────────────────────────

async function runWatch(opts: CLIOptions): Promise<void> {
  console.log('ksc: watching for changes...\n');

  let exitCode = await runCheck(opts);
  console.log('');

  const watcher = fs.watch(opts.rootDir, { recursive: true }, (_, filename) => {
    if (!filename) return;
    if (!filename.endsWith('.ts') || filename.endsWith('.d.ts')) return;
    if (filename.includes('node_modules') || filename.includes('dist')) return;

    // Debounce
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      console.clear();
      console.log('ksc: re-checking...\n');
      exitCode = await runCheck(opts);
      console.log('');
    }, 300);
  });

  let debounceTimer: ReturnType<typeof setTimeout>;

  // Keep process alive
  process.on('SIGINT', () => {
    watcher.close();
    process.exit(exitCode);
  });
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgv(process.argv);

  if (opts.command === 'check') {
    if (opts.watch) {
      await runWatch(opts);
    } else {
      const exitCode = await runCheck(opts);
      process.exit(exitCode);
    }
  } else if (opts.command === 'init') {
    const exitCode = runInit(opts);
    process.exit(exitCode);
  } else if (opts.command === '--help' || opts.command === '-h' || opts.command === 'help') {
    console.log(`
KindScript — Architectural enforcement for TypeScript

Usage:
  ksc check                          Check the project
  ksc check --config <path>          Use a specific config file
  ksc check --json                   Output diagnostics as JSON
  ksc check --depth <parse|bind|check>  Analysis depth (default: check)
  ksc check --watch                  Re-check on file changes
  ksc init                           Generate a ksc.config.ts scaffold

Exit codes:
  0  No violations
  1  Violations found
  2  Error

Kind definitions are types in your source code:
  type Pure = Kind<{ noIO: true; noMutation: true }>;

Config files (optional, auto-detected):
  kindscript.config.ts, kindscript.config.js
  ksc.config.ts, ksc.config.js
`);
    process.exit(EXIT_SUCCESS);
  } else if (opts.command === '--version' || opts.command === '-v' || opts.command === 'version') {
    const pkgPath = path.resolve(opts.rootDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    console.log(`ksc ${pkg.version}`);
    process.exit(EXIT_SUCCESS);
  } else {
    console.error(`Unknown command: ${opts.command}. Run "ksc --help" for usage.`);
    process.exit(EXIT_ERROR);
  }
}

// Only run when invoked as the entry point (not when imported for testing)
const isMain = typeof require !== 'undefined'
  ? require.main === module
  : process.argv[1]?.endsWith('cli.js') || process.argv[1]?.endsWith('cli.ts');

if (isMain) {
  main().catch(err => {
    console.error(`Error: ${err.message || err}`);
    process.exit(EXIT_ERROR);
  });
}
