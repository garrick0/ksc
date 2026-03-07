/**
 * Probe script: explores what TypeScript's checker API gives us
 * for resolving identifiers — import refs, value vs type position,
 * local shadowing, etc.
 *
 * Usage: npx tsx scripts/_ts-checker-probe.ts
 */

import ts from 'typescript';
import path from 'path';

// ── Helpers ──

const FIXTURES = path.resolve(__dirname, '..', 'test', 'fixtures');

function createTSProgram(fixtureDir: string): ts.Program {
  const srcDir = path.join(fixtureDir, 'src');
  const rootNames = ts.sys
    .readDirectory!(srcDir, ['.ts'], undefined, undefined)
    .filter((f) => !f.endsWith('.d.ts'));
  return ts.createProgram(rootNames, { strict: true, noEmit: true });
}

/**
 * Determines whether a symbol's declaration originates from an import.
 * Checks ImportSpecifier, ImportClause (default import), and NamespaceImport.
 */
function isImportSymbol(sym: ts.Symbol | undefined): boolean {
  if (!sym) return false;
  const decls = sym.declarations;
  if (!decls || decls.length === 0) return false;
  return decls.some(
    (d) =>
      ts.isImportSpecifier(d) ||
      ts.isImportClause(d) ||
      ts.isNamespaceImport(d),
  );
}

/**
 * Heuristic for "is this identifier in a value position?"
 *
 * We consider it a type position if the parent is any of:
 *  - TypeReference, TypeQuery, TypeAliasDeclaration (name), InterfaceDeclaration (name)
 *  - HeritageClause (in implements/extends)
 *  - ImportSpecifier, ImportClause, NamespaceImport (import binding itself)
 *  - ExpressionWithTypeArguments used in a heritage clause
 *  - TypeParameter
 *
 * Also check: if the import was `import type { ... }`, the symbol's
 * declaration parent will be an ImportDeclaration with isTypeOnly.
 */
function isTypePosition(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (!parent) return false;

  // Direct type-syntax parents
  if (ts.isTypeReferenceNode(parent)) return true;
  if (ts.isTypeAliasDeclaration(parent) && parent.name === node) return true;
  if (ts.isInterfaceDeclaration(parent) && parent.name === node) return true;
  if (ts.isTypeParameterDeclaration(parent)) return true;
  if (ts.isTypeQueryNode(parent)) return true;

  // Heritage clause expressions: `extends Foo` or `implements Bar`
  if (ts.isExpressionWithTypeArguments(parent)) return true;

  // Import binding positions (not really "type" or "value" — they're declarations)
  if (ts.isImportSpecifier(parent)) return true;
  if (ts.isImportClause(parent)) return true;
  if (ts.isNamespaceImport(parent)) return true;

  // `import type { X }` — if the identifier is used in a type annotation context
  // Check if the parent is part of a type annotation
  if (ts.isPropertySignature(parent)) return true;
  if (ts.isMethodSignature(parent)) return true;

  // Mapped type
  if (ts.isMappedTypeNode(parent)) return true;

  // Conditional type
  if (ts.isConditionalTypeNode(parent)) return true;

  // Intersection / Union type
  if (ts.isIntersectionTypeNode(parent)) return true;
  if (ts.isUnionTypeNode(parent)) return true;

  return false;
}

/**
 * More precise: uses the checker to determine if an identifier resolves
 * to a type-only symbol (interface, type alias, etc.)
 */
function getSymbolFlags(sym: ts.Symbol | undefined): string {
  if (!sym) return '';
  const flags: string[] = [];
  if (sym.flags & ts.SymbolFlags.Type) flags.push('Type');
  if (sym.flags & ts.SymbolFlags.Value) flags.push('Value');
  if (sym.flags & ts.SymbolFlags.Alias) flags.push('Alias');
  if (sym.flags & ts.SymbolFlags.Interface) flags.push('Interface');
  if (sym.flags & ts.SymbolFlags.TypeAlias) flags.push('TypeAlias');
  if (sym.flags & ts.SymbolFlags.Function) flags.push('Function');
  if (sym.flags & ts.SymbolFlags.Variable) flags.push('Variable');
  if (sym.flags & ts.SymbolFlags.FunctionScopedVariable) flags.push('FuncScoped');
  if (sym.flags & ts.SymbolFlags.BlockScopedVariable) flags.push('BlockScoped');
  if (sym.flags & ts.SymbolFlags.Property) flags.push('Property');
  if (sym.flags & ts.SymbolFlags.Method) flags.push('Method');
  return flags.join('|');
}

/**
 * Get the declaration kind(s) of a symbol for display.
 */
function declKinds(sym: ts.Symbol | undefined): string {
  if (!sym) return '';
  const decls = sym.declarations;
  if (!decls || decls.length === 0) return '(no decls)';
  return decls.map((d) => ts.SyntaxKind[d.kind]).join(', ');
}

interface IdentifierRow {
  name: string;
  line: number;
  col: number;
  isImportRef: boolean;
  isValuePos: boolean;
  isTypePos: boolean;
  parentKind: string;
  symbolFlags: string;
  declKinds: string;
  resolvedDeclFile: string;
}

function analyzeFile(
  tsProgram: ts.Program,
  checker: ts.TypeChecker,
  sf: ts.SourceFile,
): IdentifierRow[] {
  const rows: IdentifierRow[] = [];

  function visit(node: ts.Node) {
    if (ts.isIdentifier(node)) {
      const sym = checker.getSymbolAtLocation(node);

      // If it's an alias (e.g., import), resolve to the actual symbol
      let resolvedSym = sym;
      if (sym && sym.flags & ts.SymbolFlags.Alias) {
        try {
          resolvedSym = checker.getAliasedSymbol(sym);
        } catch {
          resolvedSym = sym;
        }
      }

      const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));

      // Determine where the resolved symbol is declared
      let resolvedDeclFile = '';
      if (resolvedSym?.declarations?.[0]) {
        const declSf = resolvedSym.declarations[0].getSourceFile();
        resolvedDeclFile = path.basename(declSf.fileName);
      }

      rows.push({
        name: node.text,
        line: line + 1,
        col: character + 1,
        isImportRef: isImportSymbol(sym),
        isValuePos: !isTypePosition(node),
        isTypePos: isTypePosition(node),
        parentKind: ts.SyntaxKind[node.parent.kind],
        symbolFlags: getSymbolFlags(sym),
        declKinds: declKinds(sym),
        resolvedDeclFile,
      });
    }

    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sf, visit);
  return rows;
}

function printTable(rows: IdentifierRow[]): void {
  // Column widths
  const nameW = Math.max(6, ...rows.map((r) => r.name.length));
  const lineW = 4;
  const colW = 3;
  const impW = 9;
  const valW = 8;
  const typW = 7;
  const pkW = Math.max(10, ...rows.map((r) => r.parentKind.length));
  const sfW = Math.max(12, ...rows.map((r) => r.symbolFlags.length));
  const dkW = Math.max(10, ...rows.map((r) => r.declKinds.length));
  const dfW = Math.max(8, ...rows.map((r) => r.resolvedDeclFile.length));

  const header = [
    'Name'.padEnd(nameW),
    'Line'.padStart(lineW),
    'Col'.padStart(colW),
    'ImportRef'.padEnd(impW),
    'ValuePos'.padEnd(valW),
    'TypePos'.padEnd(typW),
    'ParentKind'.padEnd(pkW),
    'SymbolFlags'.padEnd(sfW),
    'DeclKinds'.padEnd(dkW),
    'ResolvedIn'.padEnd(dfW),
  ].join('  ');

  console.log(header);
  console.log('-'.repeat(header.length));

  for (const r of rows) {
    console.log(
      [
        r.name.padEnd(nameW),
        String(r.line).padStart(lineW),
        String(r.col).padStart(colW),
        (r.isImportRef ? 'YES' : 'no').padEnd(impW),
        (r.isValuePos ? 'YES' : 'no').padEnd(valW),
        (r.isTypePos ? 'YES' : 'no').padEnd(typW),
        r.parentKind.padEnd(pkW),
        r.symbolFlags.padEnd(sfW),
        r.declKinds.padEnd(dkW),
        r.resolvedDeclFile.padEnd(dfW),
      ].join('  '),
    );
  }
}

// ── Main ──

interface FileSpec {
  fixture: string;
  fileName: string;
}

const filesToAnalyze: FileSpec[] = [
  { fixture: 'kind-violations', fileName: 'violating.ts' },
  { fixture: 'checker-edges', fileName: 'local-shadow.ts' },
  { fixture: 'checker-edges', fileName: 'nested-violation.ts' },
];

for (const { fixture, fileName } of filesToAnalyze) {
  const fixtureDir = path.join(FIXTURES, fixture);
  const tsProgram = createTSProgram(fixtureDir);
  const checker = tsProgram.getTypeChecker();

  const sf = tsProgram
    .getSourceFiles()
    .find((s) => s.fileName.endsWith(fileName));

  if (!sf) {
    console.error(`ERROR: Could not find ${fileName} in ${fixture}`);
    continue;
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`File: ${fixture}/src/${fileName}`);
  console.log(`${'='.repeat(80)}\n`);

  // Print the source for context
  console.log('Source:');
  const lines = sf.getFullText().split('\n');
  for (let i = 0; i < lines.length; i++) {
    console.log(`  ${String(i + 1).padStart(3)}| ${lines[i]}`);
  }
  console.log('');

  const rows = analyzeFile(tsProgram, checker, sf);
  printTable(rows);

  // Summary of interesting findings
  console.log('');
  const importRefs = rows.filter((r) => r.isImportRef && r.isValuePos);
  if (importRefs.length > 0) {
    console.log('Import references in VALUE position:');
    for (const r of importRefs) {
      console.log(
        `  - "${r.name}" at line ${r.line}:${r.col}, parent=${r.parentKind}, resolved in ${r.resolvedDeclFile}`,
      );
    }
  } else {
    console.log('No import references found in value position.');
  }

  // Check for shadowing: same name appears as both import and local
  const nameGroups = new Map<string, IdentifierRow[]>();
  for (const r of rows) {
    const list = nameGroups.get(r.name) ?? [];
    list.push(r);
    nameGroups.set(r.name, list);
  }
  for (const [name, group] of nameGroups) {
    const hasImport = group.some((r) => r.isImportRef);
    const hasLocal = group.some((r) => !r.isImportRef && r.symbolFlags.includes('Variable'));
    if (hasImport && hasLocal) {
      console.log(`  SHADOW: "${name}" has both import and local declarations`);
    }
  }
}
