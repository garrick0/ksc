#!/usr/bin/env tsx
/**
 * KindScript Compiler Dashboard Showcase
 *
 * Usage:
 *   npx tsx examples/showcase.ts              # Fixed commit mode (default)
 *   npx tsx examples/showcase.ts --mode=fixed # Fixed commit mode (explicit)
 *   npx tsx examples/showcase.ts --mode=live  # Live codebase mode
 *
 * Or via npm scripts:
 *   npm run showcase           # Fixed commit mode
 *   npm run showcase:fixed     # Fixed commit mode
 *   npm run showcase:live      # Live codebase mode
 */

import { parseArgs } from 'node:util';
import * as path from 'node:path';
import {
  setupTempProject,
  cleanupTemp,
  discoverRootFiles,
  serveDashboard,
} from './showcase-utils.js';
import { createProgram } from '../src/program.js';
import { defineConfig } from '../src/config.js';
import { exportDashboardData } from '../src/export.js';

const { values } = parseArgs({
  options: {
    mode: { type: 'string', default: 'fixed', short: 'm' },
  },
  strict: false,
});

const mode = (values.mode as string) ?? 'fixed';

async function main() {
  console.log('\n  ┌─────────────────────────────────────────┐');
  console.log('  │  KindScript Compiler Dashboard Showcase  │');
  console.log('  └─────────────────────────────────────────┘\n');
  console.log(`  Mode: ${mode}\n`);

  let rootDir: string;
  let rootFiles: string[];

  if (mode === 'fixed') {
    const project = await setupTempProject();
    rootDir = project.root;
    rootFiles = project.rootFiles;
  } else if (mode === 'live') {
    rootDir = process.cwd();
    rootFiles = discoverRootFiles(rootDir);
    console.log(`  Found ${rootFiles.length} root files in ${rootDir}\n`);
  } else {
    console.error(`  Unknown mode: ${mode}. Use --mode=fixed or --mode=live`);
    process.exit(1);
  }

  if (rootFiles.length === 0) {
    console.error('  No TypeScript files found to compile.');
    process.exit(1);
  }

  // Compile with architectural rules targeting src/
  console.log('  Compiling...');
  const config = defineConfig({
    // Pure data modules — should be free of mutations and console usage
    types:  { path: './src/types.ts',  rules: { noMutation: true, noConsole: true } },
    config: { path: './src/config.ts', rules: { noMutation: true, noConsole: true } },

    // Compiler phases — grouped as a composite with cycle detection
    compiler: {
      members: {
        binder:  { path: './src/binder.ts',  rules: { noMutation: true } },
        checker: { path: './src/checker.ts',  rules: { noConsole: true } },
        program: { path: './src/program.ts',  rules: { noMutation: true } },
      },
      rules: {
        noCycles: ['binder', 'checker', 'program'],
      },
    },

    // Export module — check for mutations
    export: { path: './src/export.ts', rules: { noMutation: true } },
  });
  const program = createProgram(rootFiles, config, {
    strict: true,
    noEmit: true,
    rootDir,
  });

  const data = exportDashboardData(program, {
    includeSource: true,
    root: rootDir,
  });

  console.log(`  Parse: ${data.parse.sourceFiles.length} source files`);
  console.log(`  Bind:  ${data.bind.symbols.length} kind symbols`);
  console.log(`  Check: ${data.check.diagnostics.length} diagnostics\n`);

  // Serve
  const server = await serveDashboard(data);

  // Cleanup on exit
  const shutdown = () => {
    console.log('\n  Shutting down...');
    server.close();
    if (mode === 'fixed') {
      cleanupTemp();
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  console.error('\n  Error:', err.message || err);
  if (mode === 'fixed') cleanupTemp();
  process.exit(1);
});
