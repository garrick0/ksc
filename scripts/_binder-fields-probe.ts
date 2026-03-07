/**
 * Probe what TS's binder populates on nodes.
 * Test both: without checker, and after triggering binding via checker.
 */
import ts from 'typescript';
import * as path from 'path';

const FIXTURES = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'test/fixtures');

const dir = path.join(FIXTURES, 'checker-edges', 'src');
const files = ts.sys.readDirectory(dir, ['.ts']);
const program = ts.createProgram(files, { strict: true, noEmit: true });

function getLocals(node: ts.Node): Map<string, ts.Symbol> | undefined {
  return (node as any).locals;
}

function getSymbol(node: ts.Node): ts.Symbol | undefined {
  return (node as any).symbol;
}

const sf = program.getSourceFiles().find(f => f.fileName.includes('local-shadow.ts'))!;

// ── Test 1: Before calling getTypeChecker ──
console.log('════════ BEFORE getTypeChecker() ════════\n');
console.log('sf.locals:', getLocals(sf)?.size ?? 'undefined');
console.log('sf (as any).nextContainer:', !!(sf as any).nextContainer);
console.log('sf (as any).symbol:', !!(sf as any).symbol);

// Check if any node has .locals
let nodesWithLocals = 0;
function walk1(node: ts.Node) {
  if (getLocals(node)?.size) nodesWithLocals++;
  if (getSymbol(node)) nodesWithLocals++;
  ts.forEachChild(node, walk1);
}
walk1(sf);
console.log('Nodes with .locals or .symbol:', nodesWithLocals);

// ── Try using internal bindSourceFile ──
console.log('\n════════ After (ts as any).bindSourceFile() ════════\n');

// TS exposes bindSourceFile internally
try {
  const binder = (ts as any).bindSourceFile;
  if (binder) {
    console.log('bindSourceFile exists:', typeof binder);
    // Don't actually call it — it might need specific args
  } else {
    console.log('bindSourceFile: not exposed');
  }
} catch (e) {
  console.log('bindSourceFile: error', e);
}

// ── Test 2: After calling getTypeChecker ──
console.log('\n════════ AFTER getTypeChecker() ════════\n');
const checker = program.getTypeChecker();

console.log('sf.locals:', getLocals(sf)?.size ?? 'undefined');

const localEntries: string[] = [];
getLocals(sf)?.forEach((sym, name) => {
  const flags: string[] = [];
  if (sym.flags & ts.SymbolFlags.Alias) flags.push('Alias');
  if (sym.flags & ts.SymbolFlags.FunctionScopedVariable) flags.push('FuncScoped');
  if (sym.flags & ts.SymbolFlags.BlockScopedVariable) flags.push('BlockScoped');
  if (sym.flags & ts.SymbolFlags.Function) flags.push('Function');
  if (sym.flags & ts.SymbolFlags.TypeAlias) flags.push('TypeAlias');
  if (sym.flags & ts.SymbolFlags.Interface) flags.push('Interface');
  localEntries.push(`  ${name}: ${flags.join('|')}`);
});
console.log('sf.locals entries:\n' + localEntries.join('\n'));

// Check containers
console.log('\nContainer .locals:');
function walk2(node: ts.Node, depth = 0) {
  const locals = getLocals(node);
  if (locals && locals.size > 0 && node !== sf) {
    const indent = '  '.repeat(depth);
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    const entries: string[] = [];
    locals.forEach((sym, name) => {
      const isAlias = !!(sym.flags & ts.SymbolFlags.Alias);
      entries.push(`${name}${isAlias ? '(import)' : ''}`);
    });
    console.log(`  ${indent}${ts.SyntaxKind[node.kind]} (line ${line}): [${entries.join(', ')}]`);
  }
  ts.forEachChild(node, child => walk2(child, depth + 1));
}
walk2(sf);

// ── Manual resolution using .locals chain ──
console.log('\nManual resolution (walking .locals chain):');
function resolveInLocals(name: string, node: ts.Node): { scope: string; isImport: boolean } | null {
  let current: ts.Node | undefined = node;
  while (current) {
    const locals = getLocals(current);
    if (locals?.has(name)) {
      const sym = locals.get(name)!;
      return {
        scope: ts.SyntaxKind[current.kind],
        isImport: !!(sym.flags & ts.SymbolFlags.Alias),
      };
    }
    current = current.parent;
  }
  return null;
}

function walkResolve(node: ts.Node) {
  if (ts.isIdentifier(node)) {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    const result = resolveInLocals(node.text, node.parent);
    if (result) {
      console.log(`  "${node.text}" line ${line}: scope=${result.scope}, isImport=${result.isImport}`);
    } else {
      console.log(`  "${node.text}" line ${line}: NOT RESOLVED (global/intrinsic)`);
    }
  }
  ts.forEachChild(node, walkResolve);
}
walkResolve(sf);

// ── Same for nested-violation.ts ──
console.log('\n════════ nested-violation.ts ════════\n');
const sf2 = program.getSourceFiles().find(f => f.fileName.includes('nested-violation.ts'))!;

console.log('Container .locals:');
function walk3(node: ts.Node, depth = 0) {
  const locals = getLocals(node);
  if (locals && locals.size > 0 && node !== sf2) {
    const indent = '  '.repeat(depth);
    const line = sf2.getLineAndCharacterOfPosition(node.getStart(sf2)).line + 1;
    const entries: string[] = [];
    locals.forEach((sym, name) => entries.push(name));
    console.log(`  ${indent}${ts.SyntaxKind[node.kind]} (line ${line}): [${entries.join(', ')}]`);
  }
  ts.forEachChild(node, child => walk3(child, depth + 1));
}
walk3(sf2);

console.log('\nManual resolution:');
function walkResolve2(node: ts.Node) {
  if (ts.isIdentifier(node)) {
    const line = sf2.getLineAndCharacterOfPosition(node.getStart(sf2)).line + 1;
    const result = resolveInLocals(node.text, node.parent);
    // Try resolving in sf2
    let current: ts.Node | undefined = node.parent;
    while (current) {
      const locals = getLocals(current);
      if (locals?.has(node.text)) {
        const sym = locals.get(node.text)!;
        const isImport = !!(sym.flags & ts.SymbolFlags.Alias);
        console.log(`  "${node.text}" line ${line}: scope=${ts.SyntaxKind[current.kind]}, isImport=${isImport}`);
        return;
      }
      current = current.parent;
    }
    console.log(`  "${node.text}" line ${line}: NOT RESOLVED`);
  }
  ts.forEachChild(node, walkResolve2);
}
walkResolve2(sf2);

console.log('\nDone.');
