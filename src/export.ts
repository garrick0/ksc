/**
 * Dashboard data export for KindScript compiler.
 *
 * Serializes the output of all three compiler stages (parse, bind, check)
 * into a JSON-friendly format consumed by compiler-dashboard.html.
 */

import ts from 'typescript';
import type { KSProgram, KindSymbol, PropertySpec } from './types.js';

// ── DashboardExportData type ────────────────────────────────────────────

export interface DashboardExportData {
  version: 1;
  project: {
    root: string;
    generatedAt: string;
    rootFiles: string[];
  };
  parse: {
    sourceFiles: Array<{
      fileName: string;
      lineCount: number;
      declarations: Array<{
        id: string;
        name: string;
        kind: string;
        pos: number;
        end: number;
        text: string;
      }>;
      source?: string;
    }>;
  };
  bind: {
    symbols: Array<{
      id: string;
      name: string;
      valueKind: string;
      declaredProperties: Record<string, boolean | number>;
      path?: string;
      resolvedFiles?: string[];
      members?: string[];
    }>;
  };
  check: {
    diagnostics: Array<{
      id: string;
      file: string;
      code: number;
      property: string;
      message: string;
      start: number;
      length: number;
      line: number;
      column: number;
    }>;
    summary: {
      totalFiles: number;
      totalSymbols: number;
      totalDiagnostics: number;
      cleanFiles: number;
      violatingFiles: number;
      byProperty: Record<string, { checked: number; violations: number }>;
    };
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function getLineAndCol(sf: ts.SourceFile, pos: number): { line: number; col: number } {
  const { line, character } = sf.getLineAndCharacterOfPosition(pos);
  return { line: line + 1, col: character + 1 };
}

/** Serialize a PropertySpec to a flat Record<string, boolean | number>. */
function serializeProperties(props: PropertySpec): Record<string, boolean | number> {
  const result: Record<string, boolean | number> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === true) result[key] = true;
    if (typeof value === 'number') result[key] = value;
  }
  return result;
}

/** Extract top-level declarations from a source file. */
function extractDeclarations(sf: ts.SourceFile): DashboardExportData['parse']['sourceFiles'][0]['declarations'] {
  const decls: DashboardExportData['parse']['sourceFiles'][0]['declarations'] = [];
  let declId = 0;

  for (const stmt of sf.statements) {
    let name: string | undefined;
    let kind: string | undefined;

    if (ts.isTypeAliasDeclaration(stmt)) {
      name = stmt.name.text;
      kind = 'TypeAlias';
    } else if (ts.isInterfaceDeclaration(stmt)) {
      name = stmt.name.text;
      kind = 'Interface';
    } else if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          const text = decl.getText(sf);
          decls.push({
            id: `${sf.fileName}:decl-${declId++}`,
            name: decl.name.text,
            kind: ts.NodeFlags.Const & stmt.declarationList.flags ? 'Const' : 'Variable',
            pos: decl.getStart(sf),
            end: decl.getEnd(),
            text: text.length > 120 ? text.slice(0, 120) + '...' : text,
          });
        }
      }
      continue;
    } else if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      name = stmt.name.text;
      kind = 'Function';
    } else if (ts.isClassDeclaration(stmt) && stmt.name) {
      name = stmt.name.text;
      kind = 'Class';
    } else if (ts.isEnumDeclaration(stmt)) {
      name = stmt.name.text;
      kind = 'Enum';
    } else if (ts.isImportDeclaration(stmt)) {
      kind = 'Import';
      if (stmt.importClause?.name) {
        name = stmt.importClause.name.text;
      } else if (stmt.importClause?.namedBindings && ts.isNamespaceImport(stmt.importClause.namedBindings)) {
        name = stmt.importClause.namedBindings.name.text;
      } else {
        name = ts.isStringLiteral(stmt.moduleSpecifier) ? stmt.moduleSpecifier.text : 'import';
      }
    } else if (ts.isExportDeclaration(stmt)) {
      name = 'export';
      kind = 'Export';
    } else if (ts.isExpressionStatement(stmt)) {
      name = stmt.expression.getText(sf).slice(0, 40);
      kind = 'ExpressionStatement';
    } else {
      continue;
    }

    if (name && kind) {
      const text = stmt.getText(sf);
      decls.push({
        id: `${sf.fileName}:decl-${declId++}`,
        name,
        kind,
        pos: stmt.getStart(sf),
        end: stmt.getEnd(),
        text: text.length > 120 ? text.slice(0, 120) + '...' : text,
      });
    }
  }

  return decls;
}

// ── Error code → property name mapping ──────────────────────────────────

const codeToProperty: Record<number, string> = {
  70001: 'noDependency',
  70002: 'noTransitiveDependency',
  70003: 'pure',
  70004: 'noCycles',
  70005: 'scope',
  70006: 'exhaustive',
  70007: 'noIO',
  70008: 'noImports',
  70009: 'noConsole',
  70010: 'immutable',
  70011: 'static',
  70012: 'noSideEffects',
  70013: 'noMutation',
  70014: 'maxFanOut',
  70015: 'noSiblingDependency',
};

// ── Main export function ────────────────────────────────────────────────

export interface ExportOptions {
  includeSource?: boolean;
  root?: string;
}

/**
 * Serialize a KSProgram's parse, bind, and check stage data
 * into a JSON-friendly format for the compiler dashboard.
 */
export function exportDashboardData(
  program: KSProgram,
  options?: ExportOptions,
): DashboardExportData {
  const includeSource = options?.includeSource ?? false;
  const root = options?.root ?? '';
  const tsProgram = program.getTSProgram();

  // ── Parse stage ──

  const sourceFiles: DashboardExportData['parse']['sourceFiles'] = [];
  for (const sf of tsProgram.getSourceFiles()) {
    if (sf.isDeclarationFile) continue;

    const text = sf.getFullText();
    const lineCount = sf.getLineStarts().length;
    const declarations = extractDeclarations(sf);

    sourceFiles.push({
      fileName: sf.fileName,
      lineCount,
      declarations,
      ...(includeSource ? { source: text } : {}),
    });
  }

  // ── Bind stage ──

  const allSymbols = program.getAllKindSymbols();
  const bindSymbols: DashboardExportData['bind']['symbols'] = [];

  for (const sym of allSymbols) {
    const entry: DashboardExportData['bind']['symbols'][0] = {
      id: sym.id,
      name: sym.name,
      valueKind: sym.valueKind,
      declaredProperties: serializeProperties(sym.declaredProperties),
    };

    if (sym.path !== undefined) entry.path = sym.path;

    // Resolve files for directory/file targets
    if (sym.path) {
      const resolved: string[] = [];
      if (sym.valueKind === 'file') {
        const suffix = sym.path.replace(/^\.\//, '').replace(/\\/g, '/');
        for (const sf of tsProgram.getSourceFiles()) {
          if (!sf.isDeclarationFile && sf.fileName.replace(/\\/g, '/').includes(suffix)) {
            resolved.push(sf.fileName);
          }
        }
      } else if (sym.valueKind === 'directory') {
        const suffix = sym.path.replace(/^\.\//, '').replace(/\\/g, '/');
        for (const sf of tsProgram.getSourceFiles()) {
          if (!sf.isDeclarationFile && sf.fileName.replace(/\\/g, '/').includes('/' + suffix + '/')) {
            resolved.push(sf.fileName);
          }
        }
      }
      if (resolved.length > 0) entry.resolvedFiles = resolved;
    }

    // Members
    if (sym.members && sym.members.size > 0) {
      entry.members = [...sym.members.values()].map(m => m.id);
    }

    bindSymbols.push(entry);
  }

  // ── Check stage ──

  const diagnostics = program.getKindDiagnostics();
  const checkDiags: DashboardExportData['check']['diagnostics'] = [];
  const fileViolations = new Set<string>();
  const allFiles = new Set<string>();
  const byProperty: Record<string, { checked: number; violations: number }> = {};

  for (const sf of tsProgram.getSourceFiles()) {
    if (!sf.isDeclarationFile) allFiles.add(sf.fileName);
  }

  // Build property → checked count from symbols
  for (const sym of allSymbols) {
    for (const [prop, val] of Object.entries(sym.declaredProperties)) {
      if (val !== true && typeof val !== 'number') continue;
      if (!byProperty[prop]) byProperty[prop] = { checked: 0, violations: 0 };
      byProperty[prop].checked++;
    }
  }

  for (let i = 0; i < diagnostics.length; i++) {
    const d = diagnostics[i];
    const fileName = d.file.fileName;
    fileViolations.add(fileName);
    const loc = getLineAndCol(d.file, d.start);
    const property = d.property ?? codeToProperty[d.code] ?? 'unknown';

    checkDiags.push({
      id: `diag-${i}`,
      file: fileName,
      code: d.code,
      property,
      message: d.messageText,
      start: d.start,
      length: d.length,
      line: loc.line,
      column: loc.col,
    });

    if (!byProperty[property]) byProperty[property] = { checked: 0, violations: 0 };
    byProperty[property].violations++;
  }

  // Collect root file names
  const rootFileNames = tsProgram.getRootFileNames();

  return {
    version: 1,
    project: {
      root,
      generatedAt: new Date().toISOString(),
      rootFiles: [...rootFileNames],
    },
    parse: { sourceFiles },
    bind: { symbols: bindSymbols },
    check: {
      diagnostics: checkDiags,
      summary: {
        totalFiles: allFiles.size,
        totalSymbols: allSymbols.length,
        totalDiagnostics: diagnostics.length,
        cleanFiles: allFiles.size - fileViolations.size,
        violatingFiles: fileViolations.size,
        byProperty,
      },
    },
  };
}
