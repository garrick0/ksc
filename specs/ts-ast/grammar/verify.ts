/**
 * Grammar Verification
 *
 * Pure function that compares the grammar registries against TypeScript's AST.
 *
 * Checks:
 * 1. Kind coverage — every ts.SyntaxKind has a matching node in our schema
 * 2. Sum type integrity — members exist, no duplicates, expression hierarchy
 * 3. Field reference validation — typeRefs resolve to known kinds/sum types
 * 4. Sum type membership — our categories match ts.isExpression/isStatement/isTypeNode
 */

import ts from 'typescript';
import type { NodeEntry, SumTypeEntry } from '../../../grammar/builder.js';

export interface VerifyDiagnostic {
  level: 'error' | 'warning';
  section: string;
  message: string;
}

export interface VerifyStats {
  tsSyntaxKindCount: number;
  ourNodeCount: number;
  kscOnlyCount: number;
  tsCoveredCount: number;
  sumTypeCount: number;
  fieldCheckCount: number;
  complexNodeCount: number;
  exprMatches: number;
  exprMismatches: number;
  stmtMatches: number;
  stmtMismatches: number;
  typeMatches: number;
  typeMismatches: number;
}

export interface VerifyResult {
  diagnostics: VerifyDiagnostic[];
  stats: VerifyStats;
  hasErrors: boolean;
}

export function verifyGrammar(
  nodes: ReadonlyMap<string, NodeEntry>,
  sumTypes: ReadonlyMap<string, SumTypeEntry>,
): VerifyResult {
  const diagnostics: VerifyDiagnostic[] = [];

  function error(section: string, message: string): void {
    diagnostics.push({ level: 'error', section, message });
  }
  function warn(section: string, message: string): void {
    diagnostics.push({ level: 'warning', section, message });
  }

  // ── 1. Kind coverage ─────────────────────────────────────────────

  const tsSyntaxKindNames = new Set<string>();
  for (const key of Object.keys(ts.SyntaxKind)) {
    if (isNaN(Number(key))) {
      if (key.startsWith('First') || key.startsWith('Last') || key === 'Count') continue;
      tsSyntaxKindNames.add(key);
    }
  }

  const ourKinds = new Set(nodes.keys());
  const kscOnlyNodes = new Set(['Program', 'CompilationUnit']);

  for (const tsKind of tsSyntaxKindNames) {
    if (!ourKinds.has(tsKind) && !kscOnlyNodes.has(tsKind)) {
      error('coverage', `Missing TypeScript SyntaxKind: ${tsKind}`);
    }
  }

  for (const ourKind of ourKinds) {
    if (!tsSyntaxKindNames.has(ourKind) && !kscOnlyNodes.has(ourKind)) {
      warn('coverage', `Kind '${ourKind}' in our schema but not in TypeScript SyntaxKind`);
    }
  }

  const tsCoveredCount = [...tsSyntaxKindNames].filter(k => ourKinds.has(k)).length;

  // ── 2. Sum type sanity checks ────────────────────────────────────

  for (const [name, st] of sumTypes) {
    for (const member of st.members) {
      if (!nodes.has(member)) {
        error('sumTypes', `Sum type '${name}' references unknown kind '${member}'`);
      }
    }
    const unique = new Set(st.members);
    if (unique.size !== st.members.length) {
      error('sumTypes', `Sum type '${name}' has duplicate members`);
    }
  }

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
        error('sumTypes', `Expression hierarchy violation: '${member}' is in ${child} but not in ${parent}`);
      }
    }
  }

  // ── 3. Field reference validation ─────────────────────────────────

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
      if (!ref) continue;
      if (!sumTypeNames.has(ref) && !nodes.has(ref)) {
        error('fields', `Field '${kind}.${fname}' references unknown type '${ref}'`);
      }
    }
  }

  for (const [kind, entry] of nodes) {
    const fieldEntries = Object.entries(entry.fields);
    if (fieldEntries.length === 0) continue;
    const hasChildFields = fieldEntries.some(
      ([, f]) => f.tag === 'child' || f.tag === 'optChild' || f.tag === 'list',
    );
    if (!hasChildFields && !kind.startsWith('JSDoc')) {
      warn('fields', `'${kind}' has ${fieldEntries.length} fields but none are child/list (all props)`);
    }
  }

  // ── 4. Sum type membership vs TypeScript type guards ──────────────

  const expressionMembers = new Set(sumTypes.get('Expression')?.members ?? []);
  const statementMembers = new Set(sumTypes.get('Statement')?.members ?? []);
  const typeNodeMembers = new Set(sumTypes.get('TypeNode')?.members ?? []);

  let exprMatches = 0, exprMismatches = 0;
  let stmtMatches = 0, stmtMismatches = 0;
  let typeMatches = 0, typeMismatches = 0;

  const kindNumToName = new Map<number, string>();
  for (const key of Object.keys(ts.SyntaxKind)) {
    if (isNaN(Number(key))) {
      const num = (ts.SyntaxKind as any)[key] as number;
      const isAlias = key.startsWith('First') || key.startsWith('Last') || key === 'Count';
      if (!isAlias) {
        kindNumToName.set(num, key);
      } else if (!kindNumToName.has(num)) {
        kindNumToName.set(num, key);
      }
    }
  }

  function getKindName(node: ts.Node): string {
    return kindNumToName.get(node.kind) ?? ts.SyntaxKind[node.kind];
  }

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

  function walkNode(node: ts.Node): void {
    const kindName = getKindName(node);

    const tsIsExpr = ts.isExpression(node);
    const weThinkExpr = expressionMembers.has(kindName);
    if (tsIsExpr && !weThinkExpr) {
      warn('membership', `ts.isExpression() says '${kindName}' is Expression, but we don't have it in Expression sum type`);
      exprMismatches++;
    } else if (tsIsExpr && weThinkExpr) {
      exprMatches++;
    }

    const tsIsStmt = ts.isStatement(node);
    const weThinkStmt = statementMembers.has(kindName);
    if (tsIsStmt && !weThinkStmt) {
      warn('membership', `ts.isStatement() says '${kindName}' is Statement, but we don't have it in Statement sum type`);
      stmtMismatches++;
    } else if (tsIsStmt && weThinkStmt) {
      stmtMatches++;
    }

    const tsIsType = ts.isTypeNode(node);
    const weThinkType = typeNodeMembers.has(kindName);
    if (tsIsType && !weThinkType) {
      warn('membership', `ts.isTypeNode() says '${kindName}' is TypeNode, but we don't have it in TypeNode sum type`);
      typeMismatches++;
    } else if (tsIsType && weThinkType) {
      typeMatches++;
    }

    ts.forEachChild(node, walkNode);
  }

  walkNode(sf);

  return {
    diagnostics,
    hasErrors: diagnostics.some(d => d.level === 'error'),
    stats: {
      tsSyntaxKindCount: tsSyntaxKindNames.size,
      ourNodeCount: ourKinds.size,
      kscOnlyCount: kscOnlyNodes.size,
      tsCoveredCount,
      sumTypeCount: sumTypes.size,
      fieldCheckCount,
      complexNodeCount,
      exprMatches,
      exprMismatches,
      stmtMatches,
      stmtMismatches,
      typeMatches,
      typeMismatches,
    },
  };
}
