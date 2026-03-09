#!/usr/bin/env tsx
/**
 * KindScript AST Explorer Showcase
 *
 * Parses TypeScript files into KS AST and serves an interactive
 * AST visualization dashboard.
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
import ts from 'typescript';
import {
  setupTempProject,
  cleanupTemp,
  discoverRootFiles,
  serveDashboard,
} from './showcase-utils.js';
import { buildKSTree } from '../generated/ts-ast/grammar/convert.js';
import { extractASTData } from '../grammar/export.js';

const { values } = parseArgs({
  options: {
    mode: { type: 'string', default: 'fixed', short: 'm' },
  },
  strict: false,
});

const mode = (values.mode as string) ?? 'fixed';

async function main() {
  console.log('\n  ┌──────────────────────────────────────┐');
  console.log('  │  KindScript AST Explorer Showcase     │');
  console.log('  └──────────────────────────────────────┘\n');
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
    console.error('  No TypeScript files found to parse.');
    process.exit(1);
  }

  // Full analysis: parse + type checker for all stamped fields
  console.log('  Analyzing (check depth)...');
  const tsProgram = ts.createProgram(rootFiles, {
    strict: true,
    noEmit: true,
    rootDir,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  });
  const ksTree = buildKSTree(tsProgram, 'check');

  // Extract AST data for dashboard
  const data = extractASTData(ksTree, 'check');
  console.log(`  Analyzed ${data.files.length} source files\n`);

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
