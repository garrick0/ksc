#!/usr/bin/env tsx
/**
 * Example: Using KindScript as a library.
 *
 * Demonstrates the programmatic API for:
 * - Creating a program from file paths
 * - Retrieving kind definitions and diagnostics
 * - Exporting AST data for the dashboard
 *
 * Usage: npx tsx examples/programmatic-api.ts
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createProgram } from '../src/application/index.js';
import { defineConfig } from '../src/api.js';
import { extractASTData } from '../src/application/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(__dirname, '..', 'test', 'fixtures', 'kind-basic', 'src');

// ── 1. Basic usage ──────────────────────────────────────────────────

console.log('=== 1. Basic Usage ===\n');

const rootFiles = ts.sys.readDirectory(FIXTURE_DIR, ['.ts']);
const program = createProgram(rootFiles, undefined, {
  strict: true,
  noEmit: true,
});

const definitions = program.getKindDefinitions();
const diagnostics = program.getDiagnostics();

console.log(`Files: ${program.getRootFileNames().length}`);
console.log(`Kind definitions found: ${definitions.length}`);
for (const def of definitions) {
  const props = Object.keys(def.properties).join(', ') || '(none)';
  console.log(`  ${def.name}: { ${props} }`);
}
console.log(`Violations: ${diagnostics.length}`);

// ── 2. With config ──────────────────────────────────────────────────

console.log('\n=== 2. With Config ===\n');

const config = defineConfig({
  analysisDepth: 'check',
});

const program2 = createProgram(rootFiles, config, {
  strict: true,
  noEmit: true,
});

console.log(`Definitions: ${program2.getKindDefinitions().length}`);
console.log(`Diagnostics: ${program2.getDiagnostics().length}`);

// ── 3. Dashboard data export ────────────────────────────────────────

console.log('\n=== 3. Dashboard Export ===\n');

const ksTree = program.getKSTree();
const dashboardData = extractASTData(ksTree, 'check');

console.log(`Version: ${dashboardData.version}`);
console.log(`Analysis depth: ${dashboardData.analysisDepth}`);
console.log(`Files in export: ${dashboardData.files.length}`);
for (const file of dashboardData.files) {
  console.log(`  ${path.basename(file.fileName)}: ${file.lineCount} lines, root=${file.ast.kind}`);
}
console.log(`Schema: ${Object.keys(dashboardData.schema.fieldDefs).length} node kinds with field defs`);
console.log(`Schema: ${Object.keys(dashboardData.schema.sumTypes).length} sum types`);

// ── 4. Attribute dependency graph ───────────────────────────────────

console.log('\n=== 4. Attribute Dep Graph ===\n');

const depGraph = program.getAttributeDepGraph();
console.log(`Attributes: ${depGraph.order.length}`);
console.log(`Evaluation order: ${depGraph.order.join(' → ')}`);
console.log(`Dependency edges: ${depGraph.edges.length}`);

console.log('\nDone!');
