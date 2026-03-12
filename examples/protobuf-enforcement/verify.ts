#!/usr/bin/env tsx
/**
 * Protobuf getter enforcement — verification script.
 *
 * Runs KindScript's protobuf getter analysis on a realistic microservice
 * codebase and verifies that all violations are detected while correct
 * usage is not flagged.
 *
 * Usage: npx tsx examples/protobuf-enforcement/verify.ts
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createProgram } from '../../src/application/index.js';
import { defineConfig } from '../../src/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, 'src');

// ── Discover source files ───────────────────────────────────────────

const rootFiles = ts.sys.readDirectory(SRC_DIR, ['.ts']);
console.log('=== Protobuf Getter Enforcement ===\n');
console.log(`Source directory: ${path.relative(process.cwd(), SRC_DIR)}`);
console.log(`Files found: ${rootFiles.length}`);
for (const f of rootFiles) {
  console.log(`  ${path.basename(f)}`);
}

// ── Run analysis with protobuf checking DISABLED ────────────────────

console.log('\n--- Without protobuf checking ---\n');

const programOff = createProgram(rootFiles, defineConfig({}), {
  strict: true,
  noEmit: true,
  rootDir: path.resolve(__dirname),
});

const diagsOff = programOff.getDiagnostics().filter(d => d.property === 'protobuf-getter');
console.log(`Protobuf violations: ${diagsOff.length} (expected: 0)`);
if (diagsOff.length !== 0) {
  console.error('FAIL: violations detected when protobuf checking is disabled');
  process.exit(1);
}
console.log('PASS: no violations when disabled\n');

// ── Run analysis with protobuf checking ENABLED ─────────────────────

console.log('--- With protobuf checking enabled ---\n');

const config = defineConfig({
  protobuf: { enabled: true },
});

const program = createProgram(rootFiles, config, {
  strict: true,
  noEmit: true,
  rootDir: path.resolve(__dirname),
});

const allDiags = program.getDiagnostics();
const pbDiags = allDiags.filter(d => d.property === 'protobuf-getter');

console.log(`Total diagnostics: ${allDiags.length}`);
console.log(`Protobuf violations: ${pbDiags.length}\n`);

// ── Print violations grouped by file ────────────────────────────────

const byFile = new Map<string, typeof pbDiags>();
for (const d of pbDiags) {
  const file = path.basename(d.fileName);
  if (!byFile.has(file)) byFile.set(file, []);
  byFile.get(file)!.push(d);
}

for (const [file, diags] of [...byFile.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`${file} (${diags.length} violations):`);
  for (const d of diags) {
    console.log(`  ${d.message}`);
  }
  console.log();
}

// ── Verify expected violations per file ─────────────────────────────

console.log('--- Verification ---\n');
let pass = true;

function expectViolationCount(file: string, min: number, label: string): void {
  const count = byFile.get(file)?.length ?? 0;
  const ok = count >= min;
  const status = ok ? 'PASS' : 'FAIL';
  console.log(`${status}: ${file} — ${label} (${count} violations, expected >= ${min})`);
  if (!ok) pass = false;
}

function expectNoViolations(file: string, label: string): void {
  const count = byFile.get(file)?.length ?? 0;
  const ok = count === 0;
  const status = ok ? 'PASS' : 'FAIL';
  console.log(`${status}: ${file} — ${label} (${count} violations, expected 0)`);
  if (!ok) pass = false;
}

function expectViolationMessage(file: string, pattern: string, label: string): void {
  const diags = byFile.get(file) ?? [];
  const found = diags.some(d => d.message.includes(pattern));
  const status = found ? 'PASS' : 'FAIL';
  console.log(`${status}: ${file} — ${label} (pattern: "${pattern}")`);
  if (!found) pass = false;
}

function expectNoViolationMessage(file: string, pattern: string, label: string): void {
  const diags = byFile.get(file) ?? [];
  const found = diags.some(d => d.message.includes(pattern));
  const status = !found ? 'PASS' : 'FAIL';
  console.log(`${status}: ${file} — ${label} (should NOT have: "${pattern}")`);
  if (found) pass = false;
}

// --- user-service.ts: fully correct, should have zero violations
expectNoViolations('user-service.ts', 'all correct getter usage');

// --- user_pb.ts: protobuf definitions only, no usage violations
expectNoViolations('user_pb.ts', 'protobuf definitions (no usage)');

// --- event_pb.ts: protobuf definitions only, no usage violations
expectNoViolations('event_pb.ts', 'protobuf definitions (no usage)');

// --- audit-logger.ts: several violations
expectViolationCount('audit-logger.ts', 4, 'direct field access violations');
expectViolationMessage('audit-logger.ts', "'.timestamp'", 'detects .timestamp on AuditEvent');
expectViolationMessage('audit-logger.ts', "'.action'", 'detects .action on AuditEvent');
expectViolationMessage('audit-logger.ts', "'.userId'", 'detects .userId on AuditEvent');

// --- api-handler.ts: violations in incorrect functions, none in correct functions
expectViolationCount('api-handler.ts', 6, 'violations in incorrect handler functions');
expectViolationMessage('api-handler.ts', "'.name'", 'detects .name on User');
expectViolationMessage('api-handler.ts', "'.email'", 'detects .email on User');
expectViolationMessage('api-handler.ts', "'.age'", 'detects .age on User');
expectNoViolationMessage('api-handler.ts', "'Config'", 'does not flag non-protobuf Config type');
expectNoViolationMessage('api-handler.ts', "'HttpRequest'", 'does not flag non-protobuf HttpRequest');

// --- namespace-usage.ts: violations via namespace imports
expectViolationCount('namespace-usage.ts', 2, 'violations via namespace imports');
expectViolationMessage('namespace-usage.ts', "'.name'", 'detects .name via namespace import');

// --- Summary
console.log();
console.log(`Total violations detected: ${pbDiags.length}`);
console.log();

if (pass) {
  console.log('ALL CHECKS PASSED');
} else {
  console.error('SOME CHECKS FAILED');
  process.exit(1);
}
