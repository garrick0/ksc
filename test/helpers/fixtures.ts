/**
 * Shared test helpers for fixture loading.
 *
 * Provides cached builders for the three common fixture patterns:
 *   1. buildProgram()     — createProgram() → KSProgramInterface (for API / e2e tests)
 *   2. buildKSTree()      — frontend.convert() → { root } (for converter / export tests)
 *   3. buildAndEvaluate() — convert + evaluator.evaluate + buildTree (for kind-checking tests)
 *
 * Plus DFS helpers: findCU(), findDNodeByKind(), findNodes().
 */
import * as path from 'node:path';
import ts from 'typescript';
import { createProgram } from '../../app/user-api/lib/program.js';
import { frontend } from '../../specs/ts-ast/frontend/convert.js';
import { wireEvaluator } from '../../evaluator/engine.js';
import { dispatchConfig } from '../../generated/ts-ast/kind-checking/dispatch.js';
import { analysisSpec } from '../../specs/ts-ast/kind-checking/spec.js';
import { grammar } from '../../specs/ts-ast/grammar/index.js';
import type { KSCAttrMap } from '../../generated/ts-ast/kind-checking/attr-types.js';
import type { TypedAGNode } from '../../evaluator/types.js';
import type { KSNode } from '../../specs/ts-ast/grammar/index.js';

// ── Constants ─────────────────────────────────────────────────────────

export const FIXTURES = path.resolve(__dirname, '../fixtures');

// ── Shared evaluator instance ─────────────────────────────────────────

const evaluator = wireEvaluator<string, KSCAttrMap>({
  grammar,
  spec: analysisSpec,
  dispatch: dispatchConfig,
});

// ── Low-level helpers ─────────────────────────────────────────────────

/** Read all .ts files from a fixture's src/ directory. */
export function getRootFiles(fixtureDir: string): string[] {
  return ts.sys.readDirectory(
    path.join(FIXTURES, fixtureDir, 'src'),
    ['.ts'],
  );
}

// ── Cached builders ───────────────────────────────────────────────────

/**
 * Cached createProgram(). Returns a KSProgramInterface.
 *
 * @param fixtureDir  Subdirectory under test/fixtures/
 * @param config      Optional TS compiler options (default: { strict: true, noEmit: true })
 *                    Pass `undefined` to use createProgram without config.
 */
const _programCache = new Map<string, ReturnType<typeof createProgram>>();

export function buildProgram(
  fixtureDir: string,
  config?: ts.CompilerOptions | undefined,
) {
  // Use 'no-config' sentinel when caller explicitly passes undefined
  const configKey = config === undefined ? 'default' : JSON.stringify(config);
  const key = `${fixtureDir}:${configKey}`;
  if (_programCache.has(key)) return _programCache.get(key)!;

  const files = getRootFiles(fixtureDir);
  const program = config === undefined
    ? createProgram(files, undefined, { strict: true, noEmit: true })
    : createProgram(files, undefined, config);

  _programCache.set(key, program);
  return program;
}

/**
 * Build program with NO config options (bare createProgram(files)).
 */
const _bareProgramCache = new Map<string, ReturnType<typeof createProgram>>();

export function buildProgramBare(fixtureDir: string) {
  if (_bareProgramCache.has(fixtureDir)) return _bareProgramCache.get(fixtureDir)!;
  const program = createProgram(getRootFiles(fixtureDir));
  _bareProgramCache.set(fixtureDir, program);
  return program;
}

/**
 * Cached frontend.convert(). Returns the KS tree { root }.
 *
 * @param fixtureDir  Subdirectory under test/fixtures/
 * @param depth       Conversion depth: 'parse' | 'bind' | 'check' (default: 'check')
 */
const _treeCache = new Map<string, ReturnType<typeof frontend.convert>>();

export function buildKSTree(
  fixtureDir: string,
  depth: 'parse' | 'bind' | 'check' = 'check',
) {
  const key = `${fixtureDir}:${depth}`;
  if (_treeCache.has(key)) return _treeCache.get(key)!;

  const files = getRootFiles(fixtureDir);
  const tsProgram = ts.createProgram(files, {
    strict: true,
    noEmit: true,
    rootDir: path.join(FIXTURES, fixtureDir),
  });
  const result = frontend.convert(tsProgram, depth);
  _treeCache.set(key, result);
  return result;
}

/**
 * Cached convert + evaluate + buildTree. Returns { ksTree, dnodeRoot, allDefs, diagnostics }.
 *
 * @param fixtureDir  Subdirectory under test/fixtures/
 */
export type EvaluateResult = {
  ksTree: ReturnType<typeof frontend.convert>;
  dnodeRoot: TypedAGNode<KSCAttrMap>;
  allDefs: ReturnType<ReturnType<typeof evaluator.evaluate>['definitions']>;
  diagnostics: ReturnType<ReturnType<typeof evaluator.evaluate>['diagnostics']>;
};

const _evaluateCache = new Map<string, EvaluateResult>();

export function buildAndEvaluate(fixtureDir: string): EvaluateResult {
  if (_evaluateCache.has(fixtureDir)) return _evaluateCache.get(fixtureDir)!;

  const files = getRootFiles(fixtureDir);
  const tsProgram = ts.createProgram(files, {
    strict: true,
    noEmit: true,
    rootDir: path.join(FIXTURES, fixtureDir),
  });
  const ksTree = frontend.convert(tsProgram);
  const evalResult = evaluator.evaluate(ksTree.root);
  const allDefs = evalResult.definitions;
  const diagnostics = evalResult.diagnostics;
  const dnodeRoot = evaluator.buildTree(ksTree.root);
  const result = { ksTree, dnodeRoot, allDefs, diagnostics };
  _evaluateCache.set(fixtureDir, result);
  return result;
}

// ── DFS helpers ───────────────────────────────────────────────────────

export type Node = TypedAGNode<KSCAttrMap>;

/** Find a CompilationUnit DNode by filename substring. */
export function findCU(dnodeRoot: Node, fileSubstr: string): Node | undefined {
  return dnodeRoot.children.find(
    cu => (cu.node as any).fileName?.includes(fileSubstr),
  );
}

/** DFS to find first AGNode whose raw node has given kind. */
export function findDNodeByKind(root: Node, kind: string): Node | undefined {
  const stack: Node[] = [...root.children];
  while (stack.length > 0) {
    const d = stack.pop()!;
    if (d.node.kind === kind) return d;
    stack.push(...d.children);
  }
  return undefined;
}

/** Find a CompilationUnit KSNode by filename substring. */
export function findKSNodeCU(root: KSNode, fileSubstr: string): KSNode | undefined {
  return (root as any).compilationUnits?.find(
    (cu: any) => cu.fileName?.includes(fileSubstr),
  );
}

/** DFS find all KSNodes matching a predicate. */
export function findNodes(root: KSNode, predicate: (n: KSNode) => boolean): KSNode[] {
  const results: KSNode[] = [];
  const stack: KSNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (predicate(node)) results.push(node);
    if (node.children) stack.push(...node.children);
  }
  return results;
}
