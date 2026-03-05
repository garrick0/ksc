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
import { defineConfig } from '../src/api/config.js';
import { exportDashboardData } from '../src/dashboard/export.js';

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

  // Compile with targets pointing at src/
  console.log('  Compiling...');
  const config = defineConfig({
    strict: true,
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
  console.log(`  Kinds: ${data.kinds.definitions.length} definitions\n`);

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
