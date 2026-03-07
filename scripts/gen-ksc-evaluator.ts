/**
 * Codegen: generates ksc-generated/evaluator.ts
 *
 * Usage: npx tsx scripts/gen-ksc-evaluator.ts
 *
 * Reads:
 *   - ksc-behavior/attr-types.ts  (attribute type map)
 *   - ksc-behavior/binder.ts      (equation functions + JSDoc overrides)
 *   - ksc-behavior/checker.ts     (equation functions + JSDoc overrides)
 *
 * Infers attribute metadata (direction, cases, rootFn, hasParentEq)
 * from equation function naming conventions:
 *   eq_X_contribute + eq_X_combine  → collection
 *   eq_X_root / eq_X_rootValue      → inh
 *   otherwise                       → syn
 *   non-reserved suffixes           → production cases
 *
 * Generates a standalone KSCDNode with:
 *   - Typed cache fields + direct attribute methods
 *   - Switch-based attr() dispatch
 *   - Schema-aware buildKSCTree
 *   - Static dependency graph (auto-derived from equation source)
 *   - evaluate() entry point
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── 1. Parse attr-types.ts for type map ─────────────────────────────

const attrTypesSource = fs.readFileSync(
  path.join(ROOT, 'ksc-behavior/attr-types.ts'), 'utf-8',
);
const typeMap = new Map<string, string>();
for (const m of attrTypesSource.matchAll(/^\s+(\w+):\s+(.+);$/gm)) {
  typeMap.set(m[1], m[2].trim());
}

// ── 2. Infer attribute metadata from equation source ────────────────

type Direction = 'syn' | 'inh' | 'collection';

interface AttrDef {
  name: string;
  spec: 'binder' | 'checker';
  direction: Direction;
  type: string;
  cases?: string[];
  rootFn?: boolean;
  hasParentEq?: boolean;
  extraArgs?: Record<string, string[]>;
}

// Reserved suffixes that are not production cases
const RESERVED_SUFFIXES = new Set([
  'default', 'root', 'rootValue', 'contribute', 'combine',
]);

interface RawExport {
  name: string;         // full export name e.g. "eq_kindDefs_CompilationUnit"
  isConst: boolean;     // export const vs export function
  jsDoc: string;        // JSDoc comment preceding the export (if any)
}

/** Scan a source file for all exported eq_* functions and constants. */
function scanExports(source: string): RawExport[] {
  const results: RawExport[] = [];
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const fnMatch = lines[i].match(/^export function (eq_\w+)/);
    if (fnMatch) {
      results.push({ name: fnMatch[1], isConst: false, jsDoc: gatherJSDoc(lines, i) });
      continue;
    }
    const constMatch = lines[i].match(/^export const (eq_\w+)/);
    if (constMatch) {
      results.push({ name: constMatch[1], isConst: true, jsDoc: gatherJSDoc(lines, i) });
    }
  }
  return results;
}

/** Gather JSDoc comment (if any) immediately preceding line index i. */
function gatherJSDoc(lines: string[], i: number): string {
  // Walk backwards from i-1 to find /** ... */ block
  let end = i - 1;
  while (end >= 0 && lines[end].trim() === '') end--;
  if (end < 0 || !lines[end].trim().endsWith('*/')) return '';
  let start = end;
  while (start > 0 && !lines[start].includes('/**')) start--;
  return lines.slice(start, end + 1).join('\n');
}

/** Parse @extraArg tags from a JSDoc string. Returns the argument expressions. */
function parseExtraArgs(jsDoc: string): string[] {
  const args: string[] = [];
  for (const m of jsDoc.matchAll(/@extraArg\s+(.+)/g)) {
    // Strip trailing */ from single-line JSDoc comments
    args.push(m[1].trim().replace(/\s*\*\/\s*$/, ''));
  }
  return args;
}

/** Given a set of raw exports for an attribute, infer the AttrDef. */
function inferAttrDef(
  attrName: string,
  exports: RawExport[],
  spec: 'binder' | 'checker',
): AttrDef {
  const type = typeMap.get(attrName);
  if (!type) throw new Error(`No type found in KSCAttrMap for attribute '${attrName}'`);

  // Build suffix set
  const suffixes = new Map<string, RawExport>(); // suffix → export
  const bareFn: RawExport | undefined = exports.find(e => e.name === `eq_${attrName}` && !e.isConst);

  for (const exp of exports) {
    const rest = exp.name.slice(`eq_${attrName}`.length);
    if (rest.startsWith('_')) {
      suffixes.set(rest.slice(1), exp);
    }
  }

  // Determine direction
  let direction: Direction;
  let rootFn: boolean | undefined;
  let hasParentEq: boolean | undefined;
  let cases: string[] | undefined;
  let extraArgs: Record<string, string[]> | undefined;

  if (suffixes.has('contribute') && suffixes.has('combine')) {
    // ── Collection ──
    direction = 'collection';
  } else if (suffixes.has('root') || suffixes.has('rootValue')) {
    // ── Inherited ──
    direction = 'inh';
    rootFn = suffixes.has('root');
    hasParentEq = !!bareFn;
  } else {
    // ── Synthesized ──
    direction = 'syn';

    // Extract production cases (non-reserved suffixes)
    const productionCases: string[] = [];
    for (const [suffix, exp] of suffixes) {
      if (!RESERVED_SUFFIXES.has(suffix)) {
        productionCases.push(suffix);
        // Check for @extraArg on this production case
        const args = parseExtraArgs(exp.jsDoc);
        if (args.length > 0) {
          if (!extraArgs) extraArgs = {};
          extraArgs[suffix] = args;
        }
      }
    }

    if (productionCases.length > 0) {
      cases = productionCases;
    }
    // else: universal equation (bare eq_X with no production cases)
  }

  return { name: attrName, spec, direction, type, cases, rootFn, hasParentEq, extraArgs };
}

/** Group raw exports by attribute name. */
function groupByAttr(exports: RawExport[], knownAttrs: Set<string>): Map<string, RawExport[]> {
  const groups = new Map<string, RawExport[]>();

  for (const exp of exports) {
    const rest = exp.name.slice(3); // strip 'eq_'
    // Find the longest matching attribute name
    let bestAttr: string | null = null;
    for (const attr of knownAttrs) {
      if (rest === attr || rest.startsWith(attr + '_')) {
        if (!bestAttr || attr.length > bestAttr.length) {
          bestAttr = attr;
        }
      }
    }
    if (bestAttr) {
      if (!groups.has(bestAttr)) groups.set(bestAttr, []);
      groups.get(bestAttr)!.push(exp);
    }
  }

  return groups;
}

// ── Read and scan equation source files ──

const binderSource = fs.readFileSync(path.join(ROOT, 'ksc-behavior/binder.ts'), 'utf-8');
const checkerSource = fs.readFileSync(path.join(ROOT, 'ksc-behavior/checker.ts'), 'utf-8');

const binderExports = scanExports(binderSource);
const checkerExports = scanExports(checkerSource);

const attrNames = new Set(typeMap.keys());

const binderGroups = groupByAttr(binderExports, attrNames);
const checkerGroups = groupByAttr(checkerExports, attrNames);

// ── Infer all attribute definitions ──

const ATTRS: AttrDef[] = [];

for (const attrName of attrNames) {
  const binderGroup = binderGroups.get(attrName);
  const checkerGroup = checkerGroups.get(attrName);

  if (binderGroup && binderGroup.length > 0) {
    ATTRS.push(inferAttrDef(attrName, binderGroup, 'binder'));
  } else if (checkerGroup && checkerGroup.length > 0) {
    ATTRS.push(inferAttrDef(attrName, checkerGroup, 'checker'));
  } else {
    throw new Error(
      `Attribute '${attrName}' declared in KSCAttrMap but no equation functions found in binder.ts or checker.ts`
    );
  }
}

// Sort ATTRS: binder first then checker, preserving type map order within each group
ATTRS.sort((a, b) => {
  if (a.spec !== b.spec) return a.spec === 'binder' ? -1 : 1;
  const aIdx = [...attrNames].indexOf(a.name);
  const bIdx = [...attrNames].indexOf(b.name);
  return aIdx - bIdx;
});

// ── 3. Parse function parameter counts from source ──────────────────

function parseFnParams(source: string): Map<string, number> {
  const result = new Map<string, number>();
  for (const match of source.matchAll(/^export function (\w+)\(([^)]*)\)/gm)) {
    const name = match[1];
    const params = match[2].trim();
    result.set(name, params ? params.split(',').length : 0);
  }
  return result;
}

const binderParams = parseFnParams(binderSource);
const checkerParams = parseFnParams(checkerSource);
const allParams = new Map([...binderParams, ...checkerParams]);

// ── 4. Parse dependency graph from equation source ──────────────────

function parseDeps(source: string, knownAttrs: Set<string>): Map<string, Set<string>> {
  const deps = new Map<string, Set<string>>();

  let currentAttr: string | null = null;
  let braceDepth = 0;
  let inFunction = false;

  for (const line of source.split('\n')) {
    // Detect exported function start
    const fnMatch = line.match(/^export function (eq_\w+)/);
    if (fnMatch) {
      const fnName = fnMatch[1];
      const rest = fnName.slice(3); // strip 'eq_'
      currentAttr = null;
      // Find the attribute name this function belongs to
      for (const attr of knownAttrs) {
        if (rest === attr || rest.startsWith(attr + '_')) {
          if (!currentAttr || attr.length > currentAttr.length) {
            currentAttr = attr;
          }
        }
      }
      if (currentAttr && !deps.has(currentAttr)) {
        deps.set(currentAttr, new Set());
      }
      inFunction = true;
      braceDepth = 0;
    }

    if (inFunction) {
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }

      // Find attr() calls
      if (currentAttr) {
        for (const match of line.matchAll(/\.attr\(['"](\w+)['"]\)/g)) {
          const depAttr = match[1];
          if (depAttr !== currentAttr && knownAttrs.has(depAttr)) {
            deps.get(currentAttr)!.add(depAttr);
          }
        }
      }

      if (braceDepth <= 0) {
        inFunction = false;
        currentAttr = null;
      }
    }
  }

  return deps;
}

const binderDeps = parseDeps(binderSource, attrNames);
const checkerDeps = parseDeps(checkerSource, attrNames);

// Merge deps
const allDeps = new Map<string, Set<string>>();
for (const a of ATTRS) {
  const d = new Set<string>();
  for (const src of [binderDeps, checkerDeps]) {
    const sd = src.get(a.name);
    if (sd) for (const dep of sd) d.add(dep);
  }
  allDeps.set(a.name, d);
}

// ── 5. Topological sort ─────────────────────────────────────────────

function topoSort(deps: Map<string, Set<string>>): string[] {
  const result: string[] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function visit(name: string) {
    if (visited.has(name)) return;
    if (inStack.has(name)) throw new Error(`Cycle in dep graph: ${name}`);
    inStack.add(name);
    const neighbors = deps.get(name);
    if (neighbors) for (const dep of neighbors) visit(dep);
    inStack.delete(name);
    visited.add(name);
    result.push(name);
  }

  for (const name of deps.keys()) visit(name);
  return result;
}

const order = topoSort(allDeps);

// ── 6. Generate evaluator.ts ────────────────────────────────────────

function generate(): string {
  const L: string[] = [];

  L.push(`/**`);
  L.push(` * AUTO-GENERATED by scripts/gen-ksc-evaluator.ts — do not edit.`);
  L.push(` *`);
  L.push(` * KSC Compiled Evaluator — fully static AG pipeline.`);
  L.push(` * KSCDNode: standalone decorated node with typed cache fields,`);
  L.push(` * switch-based dispatch, and direct equation function calls.`);
  L.push(` * No DNode inheritance, no Map-based caching, no runtime compilation.`);
  L.push(` */`);
  L.push(``);

  // ── Imports ──
  L.push(`import type { KSNode } from '../ast-schema/generated/index.js';`);
  L.push(`import { getChildFields } from '../ast-schema/generated/index.js';`);
  L.push(`import type { KSCAttrMap } from '../ksc-behavior/attr-types.js';`);
  L.push(`import type { Ctx } from '../ksc-behavior/ctx.js';`);
  L.push(`import type { KindDefinition, CheckerDiagnostic, AttributeDepGraph } from '../ksc-behavior/types.js';`);
  L.push(``);

  // Binder equation imports
  const binderImports: string[] = ['type DefIdCounter'];
  for (const a of ATTRS.filter(x => x.spec === 'binder')) {
    addEquationImports(binderImports, a);
  }
  binderImports.push('project_binder');
  L.push(`// Static equation imports — binder`);
  L.push(`import {`);
  for (let i = 0; i < binderImports.length; i++) {
    L.push(`  ${binderImports[i]},`);
  }
  L.push(`} from '../ksc-behavior/binder.js';`);
  L.push(``);

  // Checker equation imports
  const checkerImports: string[] = [];
  for (const a of ATTRS.filter(x => x.spec === 'checker')) {
    addEquationImports(checkerImports, a);
  }
  checkerImports.push('project_checker');
  L.push(`// Static equation imports — checker`);
  L.push(`import {`);
  for (let i = 0; i < checkerImports.length; i++) {
    L.push(`  ${checkerImports[i]},`);
  }
  L.push(`} from '../ksc-behavior/checker.js';`);
  L.push(``);

  // ── ATTR_NAMES ──
  L.push(`// ── KSCDNode: typed cache + switch dispatch ──`);
  L.push(``);
  L.push(`const ATTR_NAMES: ReadonlySet<string> = new Set([`);
  for (const a of ATTRS) L.push(`  '${a.name}',`);
  L.push(`]);`);
  L.push(``);

  // ── KSCDNode class ──
  L.push(`export class KSCDNode implements Ctx {`);

  // Navigation fields
  L.push(`  readonly node: KSNode;`);
  L.push(`  readonly parent: KSCDNode | undefined;`);
  L.push(`  readonly children: readonly KSCDNode[];`);
  L.push(`  readonly index: number;`);
  L.push(`  readonly isRoot: boolean;`);
  L.push(`  readonly prev: KSCDNode | undefined;`);
  L.push(`  readonly next: KSCDNode | undefined;`);
  L.push(`  readonly fieldName: string | undefined;`);
  L.push(``);
  L.push(`  private _counter: DefIdCounter;`);
  L.push(``);

  // Typed cache fields
  L.push(`  // Typed cache — undefined = not yet computed`);
  for (const a of ATTRS) {
    const ct = a.type.includes('=>') ? `(${a.type})` : a.type;
    L.push(`  private _c_${a.name}: ${ct} | undefined = undefined;`);
  }
  L.push(``);
  L.push(`  private _cyc = new Set<string>();`);
  L.push(``);

  // Constructor
  L.push(`  constructor(`);
  L.push(`    node: KSNode,`);
  L.push(`    parent: KSCDNode | undefined,`);
  L.push(`    children: KSCDNode[],`);
  L.push(`    index: number,`);
  L.push(`    fieldName: string | undefined,`);
  L.push(`    counter: DefIdCounter,`);
  L.push(`  ) {`);
  L.push(`    this.node = node;`);
  L.push(`    this.parent = parent;`);
  L.push(`    this.children = children;`);
  L.push(`    this.index = index;`);
  L.push(`    this.isRoot = !parent;`);
  L.push(`    this.prev = undefined;`);
  L.push(`    this.next = undefined;`);
  L.push(`    this.fieldName = fieldName;`);
  L.push(`    this._counter = counter;`);
  L.push(`  }`);
  L.push(``);

  // attr() switch dispatch
  L.push(`  // ── Attribute access (string-based, for serialization) ──`);
  L.push(``);
  L.push(`  attr<K extends string & keyof KSCAttrMap>(name: K): KSCAttrMap[K];`);
  L.push(`  attr(name: string): any {`);
  L.push(`    switch (name) {`);
  for (const a of ATTRS) {
    L.push(`      case '${a.name}': return this.${a.name}();`);
  }
  L.push(`      default: throw new Error(\`Unknown attribute '\${name}' on \${this.node.kind ?? 'node'}\`);`);
  L.push(`    }`);
  L.push(`  }`);
  L.push(``);

  // hasAttr()
  L.push(`  hasAttr(name: string): boolean {`);
  L.push(`    switch (name) {`);
  for (const a of ATTRS) {
    L.push(`      case '${a.name}': return this._c_${a.name} !== undefined;`);
  }
  L.push(`      default: return false;`);
  L.push(`    }`);
  L.push(`  }`);
  L.push(``);

  // attrNames
  L.push(`  get attrNames(): ReadonlySet<string> {`);
  L.push(`    return ATTR_NAMES;`);
  L.push(`  }`);
  L.push(``);

  // _setCache
  L.push(`  _setCache(name: string, value: unknown): void {`);
  L.push(`    switch (name) {`);
  for (const a of ATTRS) {
    L.push(`      case '${a.name}': this._c_${a.name} = value as ${a.type}; break;`);
  }
  L.push(`    }`);
  L.push(`  }`);
  L.push(``);

  // Structural queries
  L.push(`  // ── Structural queries ──`);
  L.push(``);
  L.push(`  parentIs(kind: string, field?: string): boolean {`);
  L.push(`    if (!this.parent) return false;`);
  L.push(`    if (this.parent.node.kind !== kind) return false;`);
  L.push(`    if (field !== undefined) return this.fieldName === field;`);
  L.push(`    return true;`);
  L.push(`  }`);
  L.push(``);
  L.push(`  childAt(field: string): KSCDNode | undefined {`);
  L.push(`    return (this.children as KSCDNode[]).find(c => c.fieldName === field);`);
  L.push(`  }`);
  L.push(``);
  L.push(`  childrenAt(field: string): KSCDNode[] {`);
  L.push(`    return (this.children as KSCDNode[]).filter(c => c.fieldName === field);`);
  L.push(`  }`);
  L.push(``);

  // Direct typed attribute methods
  L.push(`  // ── Direct typed attribute methods ──`);
  L.push(``);
  for (const a of ATTRS) {
    generateMethod(L, a);
  }

  L.push(`}`);
  L.push(``);

  // ── buildKSCTree ──
  L.push(`// ── Schema-aware tree builder ──`);
  L.push(``);
  L.push(`function buildKSCTree(root: KSNode, counter: DefIdCounter): KSCDNode {`);
  L.push(`  function build(`);
  L.push(`    raw: KSNode,`);
  L.push(`    parent: KSCDNode | undefined,`);
  L.push(`    index: number,`);
  L.push(`    fieldName: string | undefined,`);
  L.push(`  ): KSCDNode {`);
  L.push(`    const children: KSCDNode[] = [];`);
  L.push(`    const dnode = new KSCDNode(raw, parent, children, index, fieldName, counter);`);
  L.push(``);
  L.push(`    const fields = getChildFields(raw.kind);`);
  L.push(`    let childIndex = 0;`);
  L.push(`    for (const field of fields) {`);
  L.push(`      const val = (raw as any)[field];`);
  L.push(`      if (val == null) continue;`);
  L.push(`      if (Array.isArray(val)) {`);
  L.push(`        for (const item of val) {`);
  L.push(`          if (item == null) continue;`);
  L.push(`          children.push(build(item as KSNode, dnode, childIndex++, field));`);
  L.push(`        }`);
  L.push(`      } else {`);
  L.push(`        children.push(build(val as KSNode, dnode, childIndex++, field));`);
  L.push(`      }`);
  L.push(`    }`);
  L.push(``);
  L.push(`    for (let i = 0; i < children.length; i++) {`);
  L.push(`      (children[i] as any).prev = i > 0 ? children[i - 1] : undefined;`);
  L.push(`      (children[i] as any).next = i < children.length - 1 ? children[i + 1] : undefined;`);
  L.push(`    }`);
  L.push(``);
  L.push(`    return dnode;`);
  L.push(`  }`);
  L.push(``);
  L.push(`  return build(root, undefined, -1, undefined);`);
  L.push(`}`);
  L.push(``);

  // ── Static dependency graph ──
  L.push(`// ── Static dependency graph ──`);
  L.push(``);
  const edges: [string, string][] = [];
  for (const a of ATTRS) {
    const deps = allDeps.get(a.name);
    if (deps) {
      for (const dep of deps) edges.push([a.name, dep]);
    }
  }

  L.push(`const KSC_STATIC_DEP_GRAPH: AttributeDepGraph = {`);
  L.push(`  attributes: [`);
  for (const a of ATTRS) L.push(`    '${a.name}',`);
  L.push(`  ],`);
  L.push(`  edges: [`);
  for (const [from, to] of edges) {
    L.push(`    ['${from}', '${to}'],`);
  }
  L.push(`  ],`);
  L.push(`  order: [`);
  for (const name of order) L.push(`    '${name}',`);
  L.push(`  ],`);
  L.push(`  specOwnership: {`);
  for (const a of ATTRS) L.push(`    ${a.name}: 'ksc-${a.spec}',`);
  L.push(`  },`);
  L.push(`  declarations: {`);
  for (const a of ATTRS) L.push(`    ${a.name}: { direction: '${a.direction}' },`);
  L.push(`  },`);
  L.push(`};`);
  L.push(``);

  // ── EvaluationResult + evaluate ──
  L.push(`// ── Evaluation ──`);
  L.push(``);
  L.push(`export interface EvaluationResult {`);
  L.push(`  definitions: KindDefinition[];`);
  L.push(`  diagnostics: CheckerDiagnostic[];`);
  L.push(`  getDepGraph(): AttributeDepGraph;`);
  L.push(`}`);
  L.push(``);
  L.push(`export function evaluate(root: KSNode): EvaluationResult {`);
  L.push(`  const counter: DefIdCounter = { value: 0 };`);
  L.push(`  const dnodeRoot = buildKSCTree(root, counter);`);
  L.push(`  const definitions = project_binder(dnodeRoot);`);
  L.push(`  const diagnostics = project_checker(dnodeRoot);`);
  L.push(`  return { definitions, diagnostics, getDepGraph: () => KSC_STATIC_DEP_GRAPH };`);
  L.push(`}`);
  L.push(``);
  L.push(`/** Build a KSCDNode tree for direct attribute inspection (used by tests). */`);
  L.push(`export function buildTree(root: KSNode): KSCDNode {`);
  L.push(`  const counter: DefIdCounter = { value: 0 };`);
  L.push(`  return buildKSCTree(root, counter);`);
  L.push(`}`);

  return L.join('\n') + '\n';
}

// ── Helpers ─────────────────────────────────────────────────────────

function addEquationImports(imports: string[], a: AttrDef): void {
  switch (a.direction) {
    case 'syn':
      if (a.cases) {
        for (const c of a.cases) imports.push(`eq_${a.name}_${c}`);
        imports.push(`eq_${a.name}_default`);
      } else {
        imports.push(`eq_${a.name}`);
      }
      break;
    case 'inh':
      if (a.rootFn) {
        imports.push(`eq_${a.name}_root`);
      } else {
        imports.push(`eq_${a.name}_rootValue`);
      }
      if (a.hasParentEq) {
        imports.push(`eq_${a.name}`);
      }
      break;
    case 'collection':
      imports.push(`eq_${a.name}_contribute`);
      imports.push(`eq_${a.name}_combine`);
      break;
  }
}

function generateMethod(L: string[], a: AttrDef): void {
  L.push(`  ${a.name}(): ${a.type} {`);
  L.push(`    if (this._c_${a.name} !== undefined) return this._c_${a.name};`);
  L.push(`    if (this._cyc.has('${a.name}')) throw new Error(\`Circular attribute access: '${a.name}' on \${this.node.kind}\`);`);
  L.push(`    this._cyc.add('${a.name}');`);
  L.push(`    try {`);

  switch (a.direction) {
    case 'syn': generateSynBody(L, a); break;
    case 'inh': generateInhBody(L, a); break;
    case 'collection': generateCollectionBody(L, a); break;
  }

  L.push(`    } finally { this._cyc.delete('${a.name}'); }`);
  L.push(`  }`);
  L.push(``);
}

function generateSynBody(L: string[], a: AttrDef): void {
  if (a.cases && a.cases.length > 0) {
    L.push(`      switch (this.node.kind) {`);
    for (const c of a.cases) {
      const fnName = `eq_${a.name}_${c}`;
      const extra = a.extraArgs?.[c];
      if (extra) {
        L.push(`        case '${c}': return this._c_${a.name} = ${fnName}(this, ${extra.join(', ')});`);
      } else {
        const paramCount = allParams.get(fnName) ?? 1;
        if (paramCount >= 2) {
          L.push(`        case '${c}': return this._c_${a.name} = ${fnName}(this, this.node);`);
        } else {
          L.push(`        case '${c}': return this._c_${a.name} = ${fnName}(this);`);
        }
      }
    }
    L.push(`        default: return this._c_${a.name} = eq_${a.name}_default();`);
    L.push(`      }`);
  } else {
    L.push(`      return this._c_${a.name} = eq_${a.name}(this);`);
  }
}

function generateInhBody(L: string[], a: AttrDef): void {
  L.push(`      if (this.isRoot) {`);
  if (a.rootFn) {
    L.push(`        return this._c_${a.name} = eq_${a.name}_root(this);`);
  } else {
    L.push(`        return this._c_${a.name} = eq_${a.name}_rootValue;`);
  }
  L.push(`      }`);

  if (a.hasParentEq) {
    L.push(`      const result = eq_${a.name}(this.parent!);`);
    L.push(`      if (result !== undefined) return this._c_${a.name} = result;`);
  }

  L.push(`      return this._c_${a.name} = this.parent!.${a.name}();`);
}

function generateCollectionBody(L: string[], a: AttrDef): void {
  L.push(`      let result = eq_${a.name}_contribute(this);`);
  L.push(`      for (const child of this.children) {`);
  L.push(`        result = eq_${a.name}_combine(result, child.${a.name}());`);
  L.push(`      }`);
  L.push(`      return this._c_${a.name} = result;`);
}

// ── Write file ──────────────────────────────────────────────────────

const content = generate();
const outDir = path.join(ROOT, 'ksc-generated');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'evaluator.ts');
fs.writeFileSync(outPath, content, 'utf-8');
const lineCount = content.split('\n').length;
console.log(`Generated ${outPath} (${lineCount} lines)`);

// Report
console.log(`\n${ATTRS.length} attributes (all inferred from equation source):`);
for (const a of ATTRS) {
  const shape = a.cases ? `production(${a.cases.join(',')})` :
    a.direction === 'collection' ? 'collection' :
    a.direction === 'inh' ? `inh(root=${a.rootFn ? 'fn' : 'const'})` : 'universal';
  const extra = a.extraArgs ? ` [extraArgs: ${JSON.stringify(a.extraArgs)}]` : '';
  console.log(`  ${a.name}: ${a.direction} [${shape}]${extra}`);
}

console.log(`\nDependency graph:`);
for (const a of ATTRS) {
  const deps = allDeps.get(a.name)!;
  console.log(`  ${a.name} → ${deps.size > 0 ? [...deps].join(', ') : '(leaf)'}`);
}

console.log(`\nEvaluation order: ${order.join(', ')}`);
const edgeCount = [...allDeps.values()].reduce((s, d) => s + d.size, 0);
console.log(`Edges: ${edgeCount}`);
