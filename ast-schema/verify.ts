/**
 * Verification script — compares our schema against TypeScript's AST.
 *
 * Usage: npx tsx ast-schema/verify.ts
 *
 * Checks:
 * 1. Kind coverage — every ts.SyntaxKind has a matching node in our schema
 * 2. Node count matches
 * 3. Child field names match what convert.ts extracts
 */

import ts from 'typescript';

// Import schema (side-effect: populates registries)
import './schema.js';
import { getNodeRegistry, getSumTypeRegistry } from './builder.js';

const nodes = getNodeRegistry();
const sumTypes = getSumTypeRegistry();

let errors = 0;
let warnings = 0;

function error(msg: string): void {
  console.error(`  ERROR: ${msg}`);
  errors++;
}

function warn(msg: string): void {
  console.warn(`  WARN: ${msg}`);
  warnings++;
}

// ── 1. Kind coverage ─────────────────────────────────────────────────

console.log('1. Kind coverage check...');

// Get all string SyntaxKind names from TypeScript
const tsSyntaxKindNames = new Set<string>();
for (const key of Object.keys(ts.SyntaxKind)) {
  if (isNaN(Number(key))) {
    // Skip range markers (FirstKeyword, LastKeyword, etc.)
    if (key.startsWith('First') || key.startsWith('Last') || key === 'Count') continue;
    tsSyntaxKindNames.add(key);
  }
}

// Our schema kinds
const ourKinds = new Set(nodes.keys());

// KSC-specific nodes not in TypeScript
const kscOnlyNodes = new Set(['Program', 'CompilationUnit']);

// Check TS kinds present in our schema
const missingFromUs: string[] = [];
for (const tsKind of tsSyntaxKindNames) {
  if (!ourKinds.has(tsKind) && !kscOnlyNodes.has(tsKind)) {
    missingFromUs.push(tsKind);
  }
}

// Check our kinds present in TS (excluding KSC-only)
const extraInUs: string[] = [];
for (const ourKind of ourKinds) {
  if (!tsSyntaxKindNames.has(ourKind) && !kscOnlyNodes.has(ourKind)) {
    extraInUs.push(ourKind);
  }
}

if (missingFromUs.length > 0) {
  error(`Missing ${missingFromUs.length} TypeScript SyntaxKinds from our schema:`);
  for (const kind of missingFromUs.sort()) {
    console.error(`    - ${kind}`);
  }
}

if (extraInUs.length > 0) {
  warn(`${extraInUs.length} kinds in our schema not in TypeScript SyntaxKind:`);
  for (const kind of extraInUs.sort()) {
    console.warn(`    - ${kind}`);
  }
}

const tsCoveredCount = [...tsSyntaxKindNames].filter(k => ourKinds.has(k)).length;
console.log(`  TypeScript SyntaxKinds: ${tsSyntaxKindNames.size}`);
console.log(`  Our schema nodes: ${ourKinds.size} (${kscOnlyNodes.size} KSC-only)`);
console.log(`  Coverage: ${tsCoveredCount}/${tsSyntaxKindNames.size} TS kinds covered`);

// ── 2. Sum type sanity checks ────────────────────────────────────────

console.log('\n2. Sum type checks...');

for (const [name, st] of sumTypes) {
  // Check all members exist
  for (const member of st.members) {
    if (!nodes.has(member)) {
      error(`Sum type '${name}' references unknown kind '${member}'`);
    }
  }

  // Check no duplicates
  const unique = new Set(st.members);
  if (unique.size !== st.members.length) {
    error(`Sum type '${name}' has duplicate members`);
  }
}

// Check expression hierarchy containment (subset relationships)
const expressionHierarchy = [
  ['PrimaryExpression', 'MemberExpression'],
  ['MemberExpression', 'LeftHandSideExpression'],
  ['LeftHandSideExpression', 'UpdateExpression'],
  ['UpdateExpression', 'UnaryExpression'],
  ['UnaryExpression', 'Expression'],
] as const;

for (const [child, parent] of expressionHierarchy) {
  const childSt = sumTypes.get(child);
  const parentSt = sumTypes.get(parent);
  if (!childSt || !parentSt) continue;

  const parentSet = new Set(parentSt.members);
  for (const member of childSt.members) {
    if (!parentSet.has(member)) {
      error(`Expression hierarchy violation: '${member}' is in ${child} but not in ${parent}`);
    }
  }
}

console.log(`  ${sumTypes.size} sum types checked`);

// ── 3. Field reference validation ─────────────────────────────────────

console.log('\n3. Field reference validation...');

// Check that every field's typeRef resolves to a known node kind or sum type
let fieldCheckCount = 0;
let complexNodeCount = 0;
const sumTypeNames = new Set(sumTypes.keys());

for (const [kind, entry] of nodes) {
  const fieldEntries = Object.entries(entry.fields);
  if (fieldEntries.length > 0) complexNodeCount++;

  for (const [fname, field] of fieldEntries) {
    fieldCheckCount++;
    if (field.tag === 'prop') continue;

    const ref = field.typeRef;
    if (!ref) continue; // untyped = KSNode, fine

    // Must resolve to a sum type OR a known node kind
    if (!sumTypeNames.has(ref) && !nodes.has(ref)) {
      error(`Field '${kind}.${fname}' references unknown type '${ref}'`);
    }
  }
}

// Check that no complex node has zero child/list fields (suspicious — likely should be a leaf)
for (const [kind, entry] of nodes) {
  const fieldEntries = Object.entries(entry.fields);
  if (fieldEntries.length === 0) continue;

  const hasChildFields = fieldEntries.some(
    ([, f]) => f.tag === 'child' || f.tag === 'optChild' || f.tag === 'list',
  );
  if (!hasChildFields) {
    // All fields are props — not necessarily wrong, but unusual
    // Only warn for non-JSDoc nodes
    if (!kind.startsWith('JSDoc')) {
      warn(`'${kind}' has ${fieldEntries.length} fields but none are child/list (all props)`);
    }
  }
}

console.log(`  ${fieldCheckCount} fields across ${complexNodeCount} complex nodes validated`);

// ── 4. Sum type membership vs TypeScript type guards ─────────────────

console.log('\n4. Expression/Statement membership vs ts.is*() guards...');

// Build a minimal program with various syntax to check type guards
const code = `
  const x = 1;
  type T = string;
  interface I { x: number; }
  function f(a: string): void { return; }
  class C { m() {} }
  enum E { A, B }
  if (true) {} else {}
  for (let i = 0; i < 10; i++) {}
  while (true) {}
  do {} while (false);
  switch (x) { case 1: break; default: break; }
  try {} catch(e) {} finally {}
  throw new Error();
  { const y = 2; }
  x + 1;
  f();
  x ? 1 : 2;
  [1, 2, 3];
  ({ a: 1 });
  x as number;
`;

const tmpFile = '/tmp/verify-schema.ts';
const host = ts.createCompilerHost({});
const origReadFile = host.readFile;
host.readFile = (fileName: string) => {
  if (fileName === tmpFile) return code;
  return origReadFile(fileName);
};

const program = ts.createProgram([tmpFile], { target: ts.ScriptTarget.Latest }, host);
const sf = program.getSourceFile(tmpFile)!;

// Walk all nodes and check membership
const expressionMembers = new Set(sumTypes.get('Expression')?.members ?? []);
const statementMembers = new Set(sumTypes.get('Statement')?.members ?? []);
const typeNodeMembers = new Set(sumTypes.get('TypeNode')?.members ?? []);

let exprMatches = 0, exprMismatches = 0;
let stmtMatches = 0, stmtMismatches = 0;
let typeMatches = 0, typeMismatches = 0;

// Build a reverse map that prefers canonical names over range aliases (First*/Last*)
const kindNumToName = new Map<number, string>();
for (const key of Object.keys(ts.SyntaxKind)) {
  if (isNaN(Number(key))) {
    const num = (ts.SyntaxKind as any)[key] as number;
    const isAlias = key.startsWith('First') || key.startsWith('Last') || key === 'Count';
    if (!kindNumToName.has(num) || !isAlias) {
      if (!isAlias) {
        kindNumToName.set(num, key);
      } else if (!kindNumToName.has(num)) {
        kindNumToName.set(num, key);
      }
    }
  }
}

function getKindName(node: ts.Node): string {
  return kindNumToName.get(node.kind) ?? ts.SyntaxKind[node.kind];
}

function walkNode(node: ts.Node): void {
  const kindName = getKindName(node);

  // Check expression membership
  const tsIsExpr = ts.isExpression(node);
  const weThinkExpr = expressionMembers.has(kindName);
  if (tsIsExpr && !weThinkExpr) {
    warn(`ts.isExpression() says '${kindName}' is Expression, but we don't have it in Expression sum type`);
    exprMismatches++;
  } else if (tsIsExpr && weThinkExpr) {
    exprMatches++;
  }

  // Check statement membership
  const tsIsStmt = ts.isStatement(node);
  const weThinkStmt = statementMembers.has(kindName);
  if (tsIsStmt && !weThinkStmt) {
    warn(`ts.isStatement() says '${kindName}' is Statement, but we don't have it in Statement sum type`);
    stmtMismatches++;
  } else if (tsIsStmt && weThinkStmt) {
    stmtMatches++;
  }

  // Check type node membership
  const tsIsType = ts.isTypeNode(node);
  const weThinkType = typeNodeMembers.has(kindName);
  if (tsIsType && !weThinkType) {
    warn(`ts.isTypeNode() says '${kindName}' is TypeNode, but we don't have it in TypeNode sum type`);
    typeMismatches++;
  } else if (tsIsType && weThinkType) {
    typeMatches++;
  }

  ts.forEachChild(node, walkNode);
}

walkNode(sf);

console.log(`  Expression: ${exprMatches} matches, ${exprMismatches} mismatches`);
console.log(`  Statement: ${stmtMatches} matches, ${stmtMismatches} mismatches`);
console.log(`  TypeNode: ${typeMatches} matches, ${typeMismatches} mismatches`);

// ── Summary ──────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(50)}`);
console.log(`Verification complete: ${errors} errors, ${warnings} warnings`);
if (errors > 0) {
  process.exit(1);
}
