/**
 * The KindScript Checker.
 *
 * Resolves config targets to source files, walks ASTs to infer
 * properties, compares against declared rules, and emits diagnostics.
 *
 * Architecture: Property Check Registry pattern.
 * Each intrinsic property check is an independent function registered
 * in a Map<string, IntrinsicCheckFn>. The checker iterates declared
 * rules, looks up the check by name, and calls it.
 */

import ts from 'typescript';
import type {
  KindSymbol,
  KSChecker,
  KSDiagnostic,
  PropertyViolation,
} from './types.js';

// ── Intrinsic check function type ───────────────────────────────────────

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

function checkNoImports(node: ts.Node): { ok: boolean; violations: PropertyViolation[] } {
  const violations: PropertyViolation[] = [];

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
        return;
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

function checkStatic(node: ts.Node): { ok: boolean; violations: PropertyViolation[] } {
  const violations: PropertyViolation[] = [];

  function visit(n: ts.Node) {
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

      violations.push({
        property: 'noSideEffects',
        node: stmt,
        message: 'Top-level side effect statement',
      });
    }
  }

  return { ok: violations.length === 0, violations };
}

function checkNoMutation(node: ts.Node): { ok: boolean; violations: PropertyViolation[] } {
  const violations: PropertyViolation[] = [];

  function visit(n: ts.Node) {
    if (ts.isBinaryExpression(n) && isAssignmentOperator(n.operatorToken.kind)) {
      violations.push({
        property: 'noMutation',
        node: n,
        message: `Assignment: ${n.operatorToken.getText()}`,
      });
    }
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

function checkNoIO(node: ts.Node): { ok: boolean; violations: PropertyViolation[] } {
  const violations: PropertyViolation[] = [];

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
 * Resolve a KindSymbol to the AST node(s) the checker should walk.
 * Only files already in the ts.Program are considered.
 */
function resolveValueNodes(
  sym: KindSymbol,
  tsProgram: ts.Program,
): ts.Node[] {
  switch (sym.valueKind) {
    case 'file': {
      if (!sym.path) return [];
      const fileSuffix = sym.path.replace(/^\.\//, '').replace(/\\/g, '/');
      return tsProgram.getSourceFiles().filter(
        sf => !sf.isDeclarationFile &&
              sf.fileName.replace(/\\/g, '/').includes(fileSuffix),
      );
    }

    case 'directory': {
      if (!sym.path) return [];
      const dirSuffix = sym.path.replace(/^\.\//, '').replace(/\\/g, '/');
      return tsProgram.getSourceFiles().filter(sf => {
        if (sf.isDeclarationFile) return false;
        const normalized = sf.fileName.replace(/\\/g, '/');
        return normalized.includes('/' + dirSuffix + '/');
      });
    }

    case 'composite': {
      return [];
    }
  }
}

// ── Diagnostic creation ─────────────────────────────────────────────────

function createDiagnostic(
  property: string,
  sourceFile: ts.SourceFile,
  violation?: PropertyViolation,
): KSDiagnostic {
  const code = errorCodeMap[property] ?? 70000;
  let message = messageMap[property] ?? `Property '${property}' violated`;

  if (violation) {
    message += `: ${violation.message}`;
  }

  // Point at the violation node if available, otherwise the source file
  const errorNode = violation?.node ?? sourceFile;

  return {
    file: sourceFile,
    start: errorNode.getStart(sourceFile),
    length: errorNode.getWidth(sourceFile),
    messageText: message,
    category: ts.DiagnosticCategory.Error,
    code,
    property,
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
 * Create a KindScript checker for the given program and config targets.
 *
 * Uses the Property Check Registry pattern: each intrinsic property
 * is an independent function. The checker iterates declared rules,
 * looks up the check by name, and calls it.
 */
export function createKSChecker(
  tsProgram: ts.Program,
  targets: KindSymbol[],
): KSChecker {
  const tsChecker = tsProgram.getTypeChecker();

  /**
   * Check a single symbol against its declared rules.
   */
  function checkSymbol(sym: KindSymbol): KSDiagnostic[] {
    const diagnostics: KSDiagnostic[] = [];

    // Composite: check each member recursively
    if (sym.valueKind === 'composite' && sym.members) {
      for (const member of sym.members.values()) {
        diagnostics.push(...checkSymbol(member));
      }
      return diagnostics;
    }

    // Non-composite: resolve to AST nodes and check
    const nodes = resolveValueNodes(sym, tsProgram);
    const declared = sym.declaredProperties;

    for (const node of nodes) {
      const sourceFile = ts.isSourceFile(node) ? node : node.getSourceFile();

      // Boolean intrinsic checks
      for (const [prop, value] of Object.entries(declared)) {
        if (value !== true) continue;

        const check = intrinsicChecks.get(prop);
        if (!check) continue;

        const result = check(node, tsChecker);
        if (!result.ok) {
          diagnostics.push(
            createDiagnostic(prop, sourceFile, result.violations[0]),
          );
        }
      }

      // Numeric: maxFanOut
      if (declared.maxFanOut !== undefined) {
        const result = checkMaxFanOut(node, declared.maxFanOut);
        if (!result.ok) {
          diagnostics.push(
            createDiagnostic('maxFanOut', sourceFile, result.violations[0]),
          );
        }
      }
    }

    return diagnostics;
  }

  // Memoize checkProgram results
  let cached: KSDiagnostic[] | undefined;

  function checkProgram(): KSDiagnostic[] {
    if (!cached) {
      cached = [];
      for (const sym of targets) {
        cached.push(...checkSymbol(sym));
      }
    }
    return cached;
  }

  function checkSourceFile(sf: ts.SourceFile): KSDiagnostic[] {
    if (sf.isDeclarationFile) return [];
    return checkProgram().filter(d => d.file.fileName === sf.fileName);
  }

  return {
    checkSourceFile,
    checkProgram,
  };
}
