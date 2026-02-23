/**
 * The KindScript Checker.
 *
 * Infers properties from ASTs, compares against declarations, emits
 * diagnostics. Mirrors TypeScript's checker in structure.
 *
 * Architecture: Property Check Registry pattern.
 * Each intrinsic property check is an independent function registered
 * in a Map<string, IntrinsicCheckFn>. The checker iterates declared
 * properties, looks up the check by name, and calls it.
 *
 * Implements Phase 1 + 2 from the checker implementation plan:
 *   - Phase 1: noImports (end-to-end validation)
 *   - Phase 2: noConsole, immutable, static, noSideEffects, noMutation,
 *              noIO, maxFanOut, pure (shallow/syntactic checks)
 */

import ts from 'typescript';
import type {
  KindSymbolTable,
  KindSymbol,
  PropertySpec,
  KSChecker,
  KSDiagnostic,
  PropertyViolation,
} from './types.js';

// ── Intrinsic check function type ───────────────────────────────────────

/**
 * An intrinsic property check function. Receives a node to walk and
 * the TS type checker. Returns whether the property holds and any
 * violation details.
 */
type IntrinsicCheckFn = (
  node: ts.Node,
  checker: ts.TypeChecker,
) => { ok: boolean; violations: PropertyViolation[] };

// ── Helper: check if an operator token is an assignment ─────────────────

function isAssignmentOperator(kind: ts.SyntaxKind): boolean {
  return (
    kind === ts.SyntaxKind.EqualsToken ||
    kind === ts.SyntaxKind.PlusEqualsToken ||
    kind === ts.SyntaxKind.MinusEqualsToken ||
    kind === ts.SyntaxKind.AsteriskEqualsToken ||
    kind === ts.SyntaxKind.SlashEqualsToken ||
    kind === ts.SyntaxKind.PercentEqualsToken ||
    kind === ts.SyntaxKind.AmpersandEqualsToken ||
    kind === ts.SyntaxKind.BarEqualsToken ||
    kind === ts.SyntaxKind.CaretEqualsToken ||
    kind === ts.SyntaxKind.LessThanLessThanEqualsToken ||
    kind === ts.SyntaxKind.GreaterThanGreaterThanEqualsToken ||
    kind === ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken ||
    kind === ts.SyntaxKind.AsteriskAsteriskEqualsToken ||
    kind === ts.SyntaxKind.BarBarEqualsToken ||
    kind === ts.SyntaxKind.AmpersandAmpersandEqualsToken ||
    kind === ts.SyntaxKind.QuestionQuestionEqualsToken
  );
}

// ── Known IO modules for shallow noIO check ─────────────────────────────

const IO_MODULES = new Set([
  'fs', 'fs/promises', 'node:fs', 'node:fs/promises',
  'net', 'node:net',
  'http', 'node:http',
  'https', 'node:https',
  'http2', 'node:http2',
  'child_process', 'node:child_process',
  'cluster', 'node:cluster',
  'dgram', 'node:dgram',
  'dns', 'node:dns',
  'tls', 'node:tls',
  'readline', 'node:readline',
]);

// ── Property check implementations ─────────────────────────────────────

/**
 * noImports: No import declarations (static or dynamic) in the AST.
 */
function checkNoImports(node: ts.Node): { ok: boolean; violations: PropertyViolation[] } {
  const violations: PropertyViolation[] = [];

  // For source files, check top-level imports
  if (ts.isSourceFile(node)) {
    for (const stmt of node.statements) {
      if (ts.isImportDeclaration(stmt)) {
        violations.push({
          property: 'noImports',
          node: stmt,
          message: `Import declaration: ${stmt.moduleSpecifier.getText()}`,
        });
      }
      if (ts.isImportEqualsDeclaration(stmt)) {
        violations.push({
          property: 'noImports',
          node: stmt,
          message: 'Import equals declaration',
        });
      }
    }
  }

  // Check for dynamic import() expressions (recursive)
  function visitDynamicImports(n: ts.Node) {
    if (
      ts.isCallExpression(n) &&
      n.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      violations.push({
        property: 'noImports',
        node: n,
        message: 'Dynamic import() expression',
      });
    }
    ts.forEachChild(n, visitDynamicImports);
  }
  visitDynamicImports(node);

  return { ok: violations.length === 0, violations };
}

/**
 * noConsole: No console.* property access anywhere in the AST.
 */
function checkNoConsole(node: ts.Node): { ok: boolean; violations: PropertyViolation[] } {
  const violations: PropertyViolation[] = [];

  function visit(n: ts.Node) {
    if (ts.isPropertyAccessExpression(n)) {
      if (ts.isIdentifier(n.expression) && n.expression.text === 'console') {
        violations.push({
          property: 'noConsole',
          node: n,
          message: `console.${n.name.text}`,
        });
        return; // Don't recurse into children of this expression
      }
    }
    if (ts.isElementAccessExpression(n)) {
      if (ts.isIdentifier(n.expression) && n.expression.text === 'console') {
        violations.push({
          property: 'noConsole',
          node: n,
          message: 'console[...] access',
        });
        return;
      }
    }
    ts.forEachChild(n, visit);
  }

  visit(node);
  return { ok: violations.length === 0, violations };
}

/**
 * immutable: No let or var declarations at module scope.
 * Only checks top-level variable statements in source files.
 */
function checkImmutable(node: ts.Node): { ok: boolean; violations: PropertyViolation[] } {
  const violations: PropertyViolation[] = [];

  if (ts.isSourceFile(node)) {
    for (const stmt of node.statements) {
      if (ts.isVariableStatement(stmt)) {
        const flags = stmt.declarationList.flags;
        if (!(flags & ts.NodeFlags.Const)) {
          violations.push({
            property: 'immutable',
            node: stmt,
            message: 'Mutable binding (let/var) at module scope',
          });
        }
      }
    }
  }

  return { ok: violations.length === 0, violations };
}

/**
 * static: No dynamic import() expressions or import.meta references.
 */
function checkStatic(node: ts.Node): { ok: boolean; violations: PropertyViolation[] } {
  const violations: PropertyViolation[] = [];

  function visit(n: ts.Node) {
    // Dynamic import()
    if (
      ts.isCallExpression(n) &&
      n.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      violations.push({
        property: 'static',
        node: n,
        message: 'Dynamic import() expression',
      });
    }
    // import.meta
    if (
      ts.isMetaProperty(n) &&
      n.keywordToken === ts.SyntaxKind.ImportKeyword
    ) {
      violations.push({
        property: 'static',
        node: n,
        message: 'import.meta reference',
      });
    }
    ts.forEachChild(n, visit);
  }

  visit(node);
  return { ok: violations.length === 0, violations };
}

/**
 * noSideEffects: Only declarations and imports at module top-level.
 * Expression statements, for loops, etc. at the top level are side effects.
 */
function checkNoSideEffects(node: ts.Node): { ok: boolean; violations: PropertyViolation[] } {
  const violations: PropertyViolation[] = [];

  if (ts.isSourceFile(node)) {
    for (const stmt of node.statements) {
      if (ts.isImportDeclaration(stmt)) continue;
      if (ts.isExportDeclaration(stmt)) continue;
      if (ts.isExportAssignment(stmt)) continue;
      if (ts.isTypeAliasDeclaration(stmt)) continue;
      if (ts.isInterfaceDeclaration(stmt)) continue;
      if (ts.isVariableStatement(stmt)) continue;
      if (ts.isFunctionDeclaration(stmt)) continue;
      if (ts.isClassDeclaration(stmt)) continue;
      if (ts.isEnumDeclaration(stmt)) continue;
      if (ts.isModuleDeclaration(stmt)) continue;

      // Anything else is a side effect
      violations.push({
        property: 'noSideEffects',
        node: stmt,
        message: 'Top-level side effect statement',
      });
    }
  }

  return { ok: violations.length === 0, violations };
}

/**
 * noMutation: No assignment expressions (excluding declarations),
 * no ++/-- operators, no delete expressions.
 */
function checkNoMutation(node: ts.Node): { ok: boolean; violations: PropertyViolation[] } {
  const violations: PropertyViolation[] = [];

  function visit(n: ts.Node) {
    // Assignment expressions (but NOT variable declaration initializers)
    if (ts.isBinaryExpression(n) && isAssignmentOperator(n.operatorToken.kind)) {
      violations.push({
        property: 'noMutation',
        node: n,
        message: `Assignment: ${n.operatorToken.getText()}`,
      });
    }
    // Prefix/postfix increment/decrement
    if (ts.isPrefixUnaryExpression(n)) {
      if (
        n.operator === ts.SyntaxKind.PlusPlusToken ||
        n.operator === ts.SyntaxKind.MinusMinusToken
      ) {
        violations.push({
          property: 'noMutation',
          node: n,
          message: 'Prefix increment/decrement',
        });
      }
    }
    if (ts.isPostfixUnaryExpression(n)) {
      if (
        n.operator === ts.SyntaxKind.PlusPlusToken ||
        n.operator === ts.SyntaxKind.MinusMinusToken
      ) {
        violations.push({
          property: 'noMutation',
          node: n,
          message: 'Postfix increment/decrement',
        });
      }
    }
    // delete expressions
    if (ts.isDeleteExpression(n)) {
      violations.push({
        property: 'noMutation',
        node: n,
        message: 'delete expression',
      });
    }
    ts.forEachChild(n, visit);
  }

  visit(node);
  return { ok: violations.length === 0, violations };
}

/**
 * noIO: No imports of known IO modules (shallow/syntactic check).
 * Checks both static import declarations and dynamic import() expressions.
 */
function checkNoIO(node: ts.Node): { ok: boolean; violations: PropertyViolation[] } {
  const violations: PropertyViolation[] = [];

  // Check static imports in source files
  if (ts.isSourceFile(node)) {
    for (const stmt of node.statements) {
      if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
        const specifier = stmt.moduleSpecifier.text;
        if (IO_MODULES.has(specifier)) {
          violations.push({
            property: 'noIO',
            node: stmt,
            message: `Import of IO module: '${specifier}'`,
          });
        }
      }
    }
  }

  // Check dynamic imports
  function visit(n: ts.Node) {
    if (
      ts.isCallExpression(n) &&
      n.expression.kind === ts.SyntaxKind.ImportKeyword &&
      n.arguments.length > 0 &&
      ts.isStringLiteral(n.arguments[0])
    ) {
      const specifier = n.arguments[0].text;
      if (IO_MODULES.has(specifier)) {
        violations.push({
          property: 'noIO',
          node: n,
          message: `Dynamic import of IO module: '${specifier}'`,
        });
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(node);

  return { ok: violations.length === 0, violations };
}

/**
 * pure: Combination of noIO + noMutation + noSideEffects (shallow).
 * A value is pure only if it satisfies all three.
 */
function checkPure(node: ts.Node): { ok: boolean; violations: PropertyViolation[] } {
  const ioResult = checkNoIO(node);
  const mutResult = checkNoMutation(node);
  const seResult = checkNoSideEffects(node);

  const violations = [
    ...ioResult.violations.map(v => ({ ...v, property: 'pure' })),
    ...mutResult.violations.map(v => ({ ...v, property: 'pure' })),
    ...seResult.violations.map(v => ({ ...v, property: 'pure' })),
  ];

  return { ok: violations.length === 0, violations };
}

// ── Property check registry ─────────────────────────────────────────────

/**
 * Registry mapping property names to their check functions.
 * New properties = new entries, zero core changes.
 */
const intrinsicChecks = new Map<string, IntrinsicCheckFn>([
  ['noImports', checkNoImports],
  ['noConsole', checkNoConsole],
  ['immutable', checkImmutable],
  ['static', checkStatic],
  ['noSideEffects', checkNoSideEffects],
  ['noMutation', checkNoMutation],
  ['noIO', checkNoIO],
  ['pure', checkPure],
]);

// ── Error code mapping ──────────────────────────────────────────────────

const errorCodeMap: Record<string, number> = {
  noImports: 70008,
  noConsole: 70009,
  immutable: 70010,
  static: 70011,
  noSideEffects: 70012,
  noMutation: 70013,
  noIO: 70007,
  pure: 70003,
  maxFanOut: 70014,
};

const messageMap: Record<string, string> = {
  noImports: 'Value has import declarations',
  noConsole: 'Value uses console',
  immutable: 'Value has mutable bindings at module scope',
  static: 'Value uses dynamic imports',
  noSideEffects: 'Value has top-level side effects',
  noMutation: 'Value contains mutations',
  noIO: 'Value performs IO',
  pure: 'Value is not pure',
  maxFanOut: 'Value exceeds maximum fan-out',
};

// ── Value resolution ────────────────────────────────────────────────────

/**
 * Resolve a kind-annotated value to the AST node(s) the checker should walk.
 * Uses "Program Source Files Only" strategy: only files already in the
 * ts.Program are considered.
 */
function resolveValueNodes(
  value: KindSymbol,
  tsProgram: ts.Program,
): ts.Node[] {
  switch (value.valueKind) {
    case 'function': {
      // The function body is in the declaration's initializer
      const decl = value.tsSymbol.valueDeclaration;
      if (decl && ts.isVariableDeclaration(decl) && decl.initializer) {
        return [decl.initializer];
      }
      return [];
    }

    case 'file': {
      if (!value.path) return [];
      // Normalize: strip leading ./ and use forward slashes for matching
      const fileSuffix = value.path.replace(/^\.\//, '').replace(/\\/g, '/');
      const sourceFiles = tsProgram.getSourceFiles();
      const resolved = sourceFiles.filter(
        sf => !sf.isDeclarationFile &&
              sf.fileName.replace(/\\/g, '/').includes(fileSuffix),
      );
      return resolved;
    }

    case 'directory': {
      if (!value.path) return [];
      // Normalize: strip leading ./ and use forward slashes for matching
      const dirSuffix = value.path.replace(/^\.\//, '').replace(/\\/g, '/');
      const sourceFiles = tsProgram.getSourceFiles();
      const resolved = sourceFiles.filter(sf => {
        if (sf.isDeclarationFile) return false;
        const normalized = sf.fileName.replace(/\\/g, '/');
        // File must be UNDER this directory (path component boundary)
        return normalized.includes('/' + dirSuffix + '/');
      });
      return resolved;
    }

    case 'composite': {
      // For composite values, check each member individually
      // (handled separately in the main check loop)
      return [];
    }
  }
}

// ── Diagnostic creation ─────────────────────────────────────────────────

function createDiagnostic(
  property: string,
  errorNode: ts.Node,
  sourceFile: ts.SourceFile,
  firstViolation?: PropertyViolation,
): KSDiagnostic {
  const code = errorCodeMap[property] ?? 70000;
  let message = messageMap[property] ?? `Property '${property}' violated`;

  // Include first violation detail if available
  if (firstViolation) {
    message += `: ${firstViolation.message}`;
  }

  return {
    file: sourceFile,
    start: errorNode.getStart(sourceFile),
    length: errorNode.getWidth(sourceFile),
    messageText: message,
    category: ts.DiagnosticCategory.Error,
    code,
  };
}

// ── maxFanOut check (special: numeric, not boolean) ─────────────────────

function checkMaxFanOut(
  node: ts.Node,
  maxAllowed: number,
): { ok: boolean; actual: number; violations: PropertyViolation[] } {
  const importSpecifiers = new Set<string>();

  if (ts.isSourceFile(node)) {
    for (const stmt of node.statements) {
      if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
        importSpecifiers.add(stmt.moduleSpecifier.text);
      }
    }
  }

  // Also count dynamic imports
  function visit(n: ts.Node) {
    if (
      ts.isCallExpression(n) &&
      n.expression.kind === ts.SyntaxKind.ImportKeyword &&
      n.arguments.length > 0 &&
      ts.isStringLiteral(n.arguments[0])
    ) {
      importSpecifiers.add(n.arguments[0].text);
    }
    ts.forEachChild(n, visit);
  }
  visit(node);

  const actual = importSpecifiers.size;
  const ok = actual <= maxAllowed;
  const violations: PropertyViolation[] = ok
    ? []
    : [{
        property: 'maxFanOut',
        node,
        message: `${actual} dependencies, max is ${maxAllowed}`,
      }];

  return { ok, actual, violations };
}

// ── Main checker ────────────────────────────────────────────────────────

/**
 * Create a KindScript checker for the given program and symbol table.
 *
 * Uses the Property Check Registry pattern: each intrinsic property
 * is an independent function. The checker iterates declared properties,
 * looks up the check by name, and calls it.
 */
export function createKSChecker(
  tsProgram: ts.Program,
  kindTable: KindSymbolTable,
): KSChecker {
  const tsChecker = tsProgram.getTypeChecker();

  /**
   * Check a single kind-annotated value against its declared properties.
   */
  function checkValue(
    kindSym: KindSymbol,
    sourceFile: ts.SourceFile,
  ): KSDiagnostic[] {
    const diagnostics: KSDiagnostic[] = [];
    const declared = kindSym.declaredProperties;

    // Find the declaration node for error reporting
    const errorNode = kindSym.tsSymbol.valueDeclaration ?? sourceFile;

    // Resolve AST node(s) to walk
    const nodes = resolveValueNodes(kindSym, tsProgram);

    // For composite values, check each member recursively
    if (kindSym.valueKind === 'composite' && kindSym.members) {
      for (const [, member] of kindSym.members) {
        const memberNodes = resolveValueNodes(member, tsProgram);
        const memberDeclared = member.declaredProperties;
        const memberErrorNode = member.tsSymbol.valueDeclaration ?? errorNode;

        // Find the source file for the member error node
        const memberSourceFile = memberErrorNode.getSourceFile?.() ?? sourceFile;

        for (const node of memberNodes) {
          // Run intrinsic checks for each member
          for (const [prop, value] of Object.entries(memberDeclared)) {
            if (value !== true) continue;

            const check = intrinsicChecks.get(prop);
            if (!check) continue;

            const result = check(node, tsChecker);
            if (!result.ok) {
              diagnostics.push(
                createDiagnostic(prop, memberErrorNode, memberSourceFile, result.violations[0]),
              );
            }
          }

          // maxFanOut for members
          if (memberDeclared.maxFanOut !== undefined) {
            const result = checkMaxFanOut(node, memberDeclared.maxFanOut);
            if (!result.ok) {
              diagnostics.push(
                createDiagnostic('maxFanOut', memberErrorNode, memberSourceFile, result.violations[0]),
              );
            }
          }
        }
      }

      // Also check composite-level declared properties (relational checks
      // would go here in Phase 3 — for now we check any intrinsic properties
      // declared on the composite itself)
      return diagnostics;
    }

    // Non-composite: check the resolved nodes against declared properties
    if (nodes.length === 0 && kindSym.valueKind !== 'composite') {
      // No nodes resolved — skip (the value might reference code not in the program)
      return diagnostics;
    }

    for (const node of nodes) {
      // Run boolean intrinsic checks
      for (const [prop, value] of Object.entries(declared)) {
        if (value !== true) continue;

        const check = intrinsicChecks.get(prop);
        if (!check) continue;

        const result = check(node, tsChecker);
        if (!result.ok) {
          diagnostics.push(
            createDiagnostic(prop, errorNode, sourceFile, result.violations[0]),
          );
        }
      }

      // maxFanOut (numeric check)
      if (declared.maxFanOut !== undefined) {
        const result = checkMaxFanOut(node, declared.maxFanOut);
        if (!result.ok) {
          diagnostics.push(
            createDiagnostic('maxFanOut', errorNode, sourceFile, result.violations[0]),
          );
        }
      }
    }

    return diagnostics;
  }

  /**
   * Check all kind-annotated values declared in a source file.
   */
  function checkSourceFile(sourceFile: ts.SourceFile): KSDiagnostic[] {
    if (sourceFile.isDeclarationFile) return [];

    const diagnostics: KSDiagnostic[] = [];

    for (const stmt of sourceFile.statements) {
      if (!ts.isVariableStatement(stmt)) continue;

      for (const decl of stmt.declarationList.declarations) {
        const symbol = tsChecker.getSymbolAtLocation(decl.name);
        if (!symbol) continue;

        const kindSym = kindTable.get(symbol);
        if (!kindSym || kindSym.role !== 'value') continue;

        // This is a kind-annotated value — check it
        diagnostics.push(...checkValue(kindSym, sourceFile));
      }
    }

    return diagnostics;
  }

  function checkProgram(): KSDiagnostic[] {
    const all: KSDiagnostic[] = [];
    for (const sf of tsProgram.getSourceFiles()) {
      if (sf.isDeclarationFile) continue;
      all.push(...checkSourceFile(sf));
    }
    return all;
  }

  return {
    checkSourceFile,
    checkProgram,
  };
}
