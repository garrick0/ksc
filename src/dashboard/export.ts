/**
 * Dashboard data export for KindScript compiler.
 *
 * Serializes the output of compiler stages (parse, kinds, check)
 * into a JSON-friendly format consumed by compiler-dashboard.html.
 */

import type { KSProgramInterface, KindDefinition, AttributeDepGraph } from '../pipeline/types.js';
import type {
  KSCompilationUnit,
  KSNode,
  KSIdentifier,
  KSVariableDeclaration,
  KSVariableStatement,
  KSVariableDeclarationList,
  KSImportDeclaration,
  KSImportClause,
  KSNamespaceImport,
  KSStringLiteral,
  KSExpressionStatement,
} from '../pipeline/ast.js';
import { serializeKSNode, type SerializedKSNode } from '../pipeline/serialize.js';

// ── AST node type ───────────────────────────────────────────────────────

export interface ASTNode {
  kind: string;
  name?: string;
  pos: number;
  end: number;
  text: string;
  children: ASTNode[];
}

// ── DashboardExportData type ────────────────────────────────────────────

export interface DashboardExportData {
  version: 2;
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
      ast?: ASTNode;
      ksAst?: SerializedKSNode;
    }>;
  };
  kinds: {
    definitions: Array<{
      id: string;
      name: string;
      properties: Record<string, unknown>;
      sourceFile: string;
    }>;
    annotations: Array<{
      id: string;
      kindName: string;
      name: string;
      sourceFile: string;
    }>;
  };
  depGraph?: AttributeDepGraph;
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
      totalDefinitions: number;
      totalAnnotations: number;
      totalDiagnostics: number;
      cleanFiles: number;
      violatingFiles: number;
      byProperty: Record<string, { checked: number; violations: number }>;
    };
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Extract top-level declarations from a compilation unit. */
function extractDeclarations(cu: KSCompilationUnit): DashboardExportData['parse']['sourceFiles'][0]['declarations'] {
  const decls: DashboardExportData['parse']['sourceFiles'][0]['declarations'] = [];
  let declId = 0;

  for (const stmt of cu.children) {
    let name: string | undefined;
    let kind: string | undefined;

    if (stmt.kind === 'TypeAliasDeclaration') {
      const named = stmt as { name: KSIdentifier };
      name = named.name.escapedText;
      kind = 'TypeAlias';
    } else if (stmt.kind === 'InterfaceDeclaration') {
      const named = stmt as { name: KSIdentifier };
      name = named.name.escapedText;
      kind = 'Interface';
    } else if (stmt.kind === 'VariableStatement') {
      const vs = stmt as KSVariableStatement;
      const dl = vs.declarationList as KSVariableDeclarationList;
      for (const decl of dl.declarations) {
        if (decl.name?.kind === 'Identifier') {
          const text = decl.text;
          decls.push({
            id: `${cu.fileName}:decl-${declId++}`,
            name: (decl.name as KSIdentifier).escapedText,
            kind: dl.isConst ? 'Const' : 'Variable',
            pos: decl.pos,
            end: decl.end,
            text: text.length > 120 ? text.slice(0, 120) + '...' : text,
          });
        }
      }
      continue;
    } else if (stmt.kind === 'FunctionDeclaration') {
      const named = stmt as { name?: KSIdentifier };
      if (!named.name) continue;
      name = named.name.escapedText;
      kind = 'Function';
    } else if (stmt.kind === 'ClassDeclaration') {
      const named = stmt as { name?: KSIdentifier };
      if (!named.name) continue;
      name = named.name.escapedText;
      kind = 'Class';
    } else if (stmt.kind === 'EnumDeclaration') {
      const named = stmt as { name: KSIdentifier };
      name = named.name.escapedText;
      kind = 'Enum';
    } else if (stmt.kind === 'ImportDeclaration') {
      const imp = stmt as KSImportDeclaration;
      kind = 'Import';
      const clause = imp.importClause as KSImportClause | undefined;
      if (clause?.name) {
        name = clause.name.escapedText;
      } else if (clause?.namedBindings?.kind === 'NamespaceImport') {
        name = (clause.namedBindings as KSNamespaceImport).name.escapedText;
      } else {
        name = imp.moduleSpecifier.kind === 'StringLiteral'
          ? (imp.moduleSpecifier as KSStringLiteral).value
          : 'import';
      }
    } else if (stmt.kind === 'ExportDeclaration') {
      name = 'export';
      kind = 'Export';
    } else if (stmt.kind === 'ExpressionStatement') {
      const es = stmt as KSExpressionStatement;
      const exprText = es.expression.text;
      name = exprText.length > 40 ? exprText.slice(0, 40) : exprText;
      kind = 'ExpressionStatement';
    } else {
      continue;
    }

    if (name && kind) {
      const text = stmt.text;
      decls.push({
        id: `${cu.fileName}:decl-${declId++}`,
        name,
        kind,
        pos: stmt.pos,
        end: stmt.end,
        text: text.length > 120 ? text.slice(0, 120) + '...' : text,
      });
    }
  }

  return decls;
}

/** Recursively walk the KS AST and produce a serializable tree. */
function extractAST(cu: KSCompilationUnit): ASTNode {
  function walk(node: KSNode): ASTNode {
    let name: string | undefined;
    const named = node as { name?: KSNode };
    if (named.name?.kind === 'Identifier') {
      name = (named.name as KSIdentifier).escapedText;
    }

    const full = node.text;
    const firstLine = full.split('\n')[0];
    const text = firstLine.length > 80 ? firstLine.slice(0, 77) + '...' : firstLine;

    const children: ASTNode[] = node.children.map(child => walk(child));

    const result: ASTNode = { kind: node.kind, pos: node.pos, end: node.end, text, children };
    if (name) result.name = name;
    return result;
  }

  return walk(cu);
}

// ── Annotation extraction ────────────────────────────────────────────────

/** Find the CompilationUnit ancestor of a node. */
function findCompilationUnit(node: KSNode): KSCompilationUnit | undefined {
  let current: any = node;
  while (current) {
    if (current.kind === 'CompilationUnit') return current as KSCompilationUnit;
    current = current.$parent;
  }
  return undefined;
}

/** Compute line and column (1-based) from a position and line starts. */
function posToLineColumn(pos: number, lineStarts: readonly number[]): { line: number; column: number } {
  // Binary search for the line
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= pos) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, column: pos - lineStarts[lo] + 1 };
}

/**
 * Walk the KS tree to find VariableDeclaration nodes with kindAnnotations.
 * Returns annotation entries for the dashboard.
 */
function extractAnnotations(
  ksTree: { root: { children: KSNode[] } },
): DashboardExportData['kinds']['annotations'] {
  const annotations: DashboardExportData['kinds']['annotations'] = [];
  let annId = 0;

  // Walk each compilation unit
  for (const cu of ksTree.root.children) {
    const fileName = (cu as KSCompilationUnit).fileName ?? '';
    const stack: KSNode[] = [cu];

    while (stack.length > 0) {
      const node = stack.pop()!;

      if (node.kind === 'VariableDeclaration') {
        const kinds: KindDefinition[] | undefined = (node as any).kindAnnotations;
        if (kinds && kinds.length > 0) {
          const varName = (node as KSVariableDeclaration).name?.kind === 'Identifier'
            ? ((node as KSVariableDeclaration).name as KSIdentifier).escapedText
            : '';
          for (const k of kinds) {
            annotations.push({
              id: `kann-${annId++}`,
              kindName: k.name,
              name: varName,
              sourceFile: fileName,
            });
          }
        }
      }

      // Push children in reverse for DFS order
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push(node.children[i]);
      }
    }
  }

  return annotations;
}

// ── Main export function ────────────────────────────────────────────────

export interface ExportOptions {
  includeSource?: boolean;
  /** Include AG attributes in KS AST nodes. Default: false */
  includeAttributes?: boolean;
  root?: string;
}

/** Curated list of AG attributes to include in KS AST export. */
const DASHBOARD_ATTRIBUTES = [
  'kindDefs',
  'kindAnnotations',
  'valueImports',
  'localBindings',
  'importViolation',
  'allViolations',
];

/**
 * Serialize a KSProgramInterface's parse, kinds, and check stage data
 * into a JSON-friendly format for the compiler dashboard.
 */
export function exportDashboardData(
  program: KSProgramInterface,
  options?: ExportOptions,
): DashboardExportData {
  const includeSource = options?.includeSource ?? false;
  const includeAttributes = options?.includeAttributes ?? false;
  const root = options?.root ?? '';
  const ksTree = program.getKSTree();

  // ── Parse stage ──

  const sourceFiles: DashboardExportData['parse']['sourceFiles'] = [];
  for (const cu of ksTree.root.compilationUnits) {
    if (cu.isDeclarationFile) continue;

    const lineCount = cu.lineStarts.length;
    const declarations = extractDeclarations(cu);

    const extra: { source?: string; ast?: ASTNode; ksAst?: SerializedKSNode } = {};
    if (includeSource) {
      extra.source = cu.sourceText;
      extra.ast = extractAST(cu);
      extra.ksAst = serializeKSNode(cu, includeAttributes
        ? { includeAttributes: true, attributeFilter: DASHBOARD_ATTRIBUTES }
        : undefined,
      );
    }

    sourceFiles.push({
      fileName: cu.fileName,
      lineCount,
      declarations,
      ...extra,
    });
  }

  // ── Kinds stage ──

  const kindDefinitions = program.getKindDefinitions();

  // Build a map from KindDefinition → source file name via the KSC tree
  const defToFile = new Map<string, string>();
  for (const def of kindDefinitions) {
    const cu = findCompilationUnit(def.node);
    if (cu) defToFile.set(def.id, cu.fileName);
  }

  // Extract annotations from the attributed KS tree
  const annotations = extractAnnotations(ksTree);

  // ── Check stage ──

  const checkerDiags = program.getDiagnostics();

  // Build a map from fileName → lineStarts for line/column computation
  const lineStartsMap = new Map<string, readonly number[]>();
  for (const cu of ksTree.root.compilationUnits) {
    lineStartsMap.set(cu.fileName, cu.lineStarts);
  }

  const diagnostics: DashboardExportData['check']['diagnostics'] = checkerDiags.map((d, i) => {
    const lineStarts = lineStartsMap.get(d.fileName);
    const { line, column } = lineStarts
      ? posToLineColumn(d.pos, lineStarts)
      : { line: 1, column: 1 };

    return {
      id: `c-${i}`,
      file: d.fileName,
      code: 70200,
      property: d.property,
      message: d.message,
      start: d.pos,
      length: d.end - d.pos,
      line,
      column,
    };
  });

  // Build summary
  const diagFiles = new Set(diagnostics.map(d => d.file));
  const byProperty: Record<string, { checked: number; violations: number }> = {};
  for (const ann of annotations) {
    const prop = kindDefinitions.find(d => d.name === ann.kindName)?.properties;
    if (prop) {
      for (const key of Object.keys(prop)) {
        if (!byProperty[key]) byProperty[key] = { checked: 0, violations: 0 };
        byProperty[key].checked++;
      }
    }
  }
  for (const d of diagnostics) {
    if (!byProperty[d.property]) byProperty[d.property] = { checked: 0, violations: 0 };
    byProperty[d.property].violations++;
  }

  const rootFileNames = program.getRootFileNames();
  const depGraph = program.getAttributeDepGraph();

  return {
    version: 2,
    project: {
      root,
      generatedAt: new Date().toISOString(),
      rootFiles: [...rootFileNames],
    },
    parse: { sourceFiles },
    depGraph,
    kinds: {
      definitions: kindDefinitions.map(d => ({
        id: d.id,
        name: d.name,
        properties: d.properties as Record<string, unknown>,
        sourceFile: defToFile.get(d.id) ?? '',
      })),
      annotations,
    },
    check: {
      diagnostics,
      summary: {
        totalFiles: sourceFiles.length,
        totalDefinitions: kindDefinitions.length,
        totalAnnotations: annotations.length,
        totalDiagnostics: diagnostics.length,
        cleanFiles: sourceFiles.length - diagFiles.size,
        violatingFiles: diagFiles.size,
        byProperty,
      },
    },
  };
}
