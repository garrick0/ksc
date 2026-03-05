/**
 * The KindScript Program object.
 *
 * Top-level coordinator: creates the TypeScript program, converts to
 * KSC AST, and evaluates binder + checker specs via the three-object
 * architecture (Grammar, Semantics, interpret).
 */

import ts from 'typescript';
import type { KSProgramInterface, KindDefinition, CheckerDiagnostic, AttributeDepGraph } from './pipeline/types.js';
import type { KindScriptConfig } from './api/config.js';
import { buildKSTree } from './pipeline/convert.js';
import { getChildren } from './pipeline/ast.js';
import { createBinderSpec } from './pipeline/binder.js';
import { createCheckerSpec } from './pipeline/checker.js';
import { createGrammar } from '../libs/ag/src/grammar.js';
import { createSemantics } from '../libs/ag/src/semantics.js';
import { interpret } from '../libs/ag/src/interpret.js';
import { analyzeDeps } from '../libs/ag/src/analyze.js';

/**
 * Create a KindScript program from root file names and optional config.
 */
export function createProgram(
  rootNames: string[],
  config?: KindScriptConfig,
  options?: ts.CompilerOptions,
): KSProgramInterface {
  const tsProgram = ts.createProgram(rootNames, options ?? {});
  return createProgramFromTSProgram(tsProgram, config);
}

/**
 * Create a KindScript program from an existing ts.Program.
 */
export function createProgramFromTSProgram(
  tsProgram: ts.Program,
  config?: KindScriptConfig,
): KSProgramInterface {
  // 1. Convert TS AST -> KSC AST
  const ksTree = buildKSTree(tsProgram);

  // 2. Structure
  const grammar = createGrammar(getChildren);

  // 3. Behavior (validates, sorts, compiles — no tree needed)
  const semantics = createSemantics(grammar, [
    createBinderSpec(),
    createCheckerSpec(),
  ]);

  // 4. Orchestration (stamps tree, installs attributes, projects results)
  const results = interpret(semantics, ksTree.root);

  const allDefs = (results.get('ksc-binder') as KindDefinition[]) ?? [];
  const diagnostics = (results.get('ksc-checker') as CheckerDiagnostic[]) ?? [];

  // Build attribute dep graph (lazy — computed once on first access)
  let depGraph: AttributeDepGraph | undefined;
  function buildDepGraph(): AttributeDepGraph {
    if (depGraph) return depGraph;

    const analysis = analyzeDeps(getChildren, semantics.compiled, ksTree.root);

    const specOwnership: Record<string, string> = {};
    const declarations: Record<string, { direction: string }> = {};
    for (const spec of semantics.specs) {
      for (const [name] of spec.compiled) {
        specOwnership[name] = spec.name;
      }
    }
    for (const [name, decl] of semantics.declarations) {
      declarations[name] = { direction: decl.direction };
    }

    const edges: [string, string][] = [];
    for (const [attr, deps] of analysis.deps) {
      for (const dep of deps) {
        edges.push([attr, dep]);
      }
    }

    depGraph = {
      attributes: [...semantics.compiled.keys()],
      edges,
      order: analysis.order,
      specOwnership,
      declarations,
    };
    return depGraph;
  }

  return {
    getRootFileNames: () => ksTree.root.compilationUnits.map(cu => cu.fileName),
    getCompilationUnits: () => ksTree.root.compilationUnits,
    getKindDefinitions: () => allDefs,
    getDiagnostics: () => diagnostics,
    getKSTree: () => ksTree,
    getAttributeDepGraph: buildDepGraph,
  };
}
