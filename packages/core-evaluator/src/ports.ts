/**
 * Evaluator port contracts — interfaces for the AG evaluator engine.
 *
 * Ports defined here:
 *   - DispatchConfig          — what generated dispatch provides (per-attribute routing)
 *   - EvaluatorConfig<P>      — how the evaluator is assembled at composition roots
 *   - AGNodeInterface         — the decorated AST node contract
 *   - TypedAGNode<M>          — type-safe attribute access
 *
 * The evaluator is parameterized by dispatch functions (generated) and
 * grammar metadata (from adapters). This module defines the shapes
 * that connect those pieces.
 */

import type { Ctx } from './ctx.js';
import type { ASTNode, Grammar, AttributeDepGraph } from '@kindscript/core-grammar';
import type { AnalysisProjections } from './analysis-ports.js';

// ── Dispatch entries (per-attribute, provided by generated dispatch.ts) ──

export interface SynDispatchEntry {
  direction: 'syn';
  /** Compute the attribute value. Called with (ctx) or (ctx, param). */
  compute: (ctx: Ctx, ...args: any[]) => any;
}

export interface InhDispatchEntry {
  direction: 'inh';
  /** Compute the root value. Called with (ctx) or (ctx, param). */
  computeRoot: (ctx: Ctx, ...args: any[]) => any;
  /**
   * Compute parent override for an inherited attribute.
   *
   * IMPORTANT: `ctx` refers to the **child** node requesting the attribute,
   * not the parent. Use `ctx.parent` to access the parent node.
   * This convention allows the equation to inspect the child's position
   * (e.g., `ctx.node.kind`, `ctx.fieldName`) when deciding overrides.
   *
   * Return `undefined` to trigger copy-down (inherit parent's value).
   * Return any other value (including `null`) to override.
   */
  computeParent?: (ctx: Ctx, ...args: any[]) => any;
}

export interface CollectionDispatchEntry {
  direction: 'collection';
  /** Initial value for the fold. */
  init: any;
  /** Binary combine function: (accumulator, childContribution) => combined. */
  combine: (acc: any, contrib: any) => any;
}

export type DispatchEntry = SynDispatchEntry | InhDispatchEntry | CollectionDispatchEntry;

/** Per-attribute dispatch config: attrName → dispatch entry. */
export type DispatchConfig = Record<string, DispatchEntry>;

// ── Evaluator config (assembled at the composition root) ──

export interface EvaluatorConfig<K extends string = string, M = Record<string, unknown>, P extends Record<string, unknown> = Record<string, unknown>> {
  /** Per-attribute dispatch (from generated dispatch.ts). */
  dispatch: DispatchConfig;
  /** Grammar — provides fieldDefs for tree building and fileContainerKind/fileNameField for structural queries. */
  grammar: Grammar<K>;
  /** Projection functions: extract final results from evaluated root. Typed by M for attr access and P for return types. */
  projections: { [Key in keyof P]: (root: TypedAGNode<M>) => P[Key] };
  /** Optional setup function called before each evaluation (e.g., resetCounter). */
  setup?: () => void;
}

// ── Evaluation target (runtime counterpart to CodegenTarget<K>) ──────

/**
 * Port: EvaluationTarget — what a fully-assembled analysis target provides at runtime.
 *
 * Symmetric counterpart to CodegenTarget<K> (in @kindscript/core-codegen).
 * CodegenTarget bundles grammar + AnalysisDecl + output config for build-time codegen.
 * EvaluationTarget bundles grammar + generated dispatch + projections + dep graph for runtime.
 *
 * Composition roots construct an EvaluationTarget from concrete adapters, then
 * pass it to createEvaluatorFromTarget() to get a ready-to-use Evaluator.
 */
export interface EvaluationTarget<K extends string = string, M = Record<string, unknown>, P extends Record<string, unknown> = Record<string, unknown>> {
  /** Grammar — provides fieldDefs for tree building and fileContainerKind/fileNameField for structural queries. */
  grammar: Grammar<K>;
  /** Per-attribute dispatch (from generated dispatch.ts). */
  dispatch: DispatchConfig;
  /** Analysis projections — projection functions + optional setup. */
  projections: AnalysisProjections<M, P>;
  /** Static attribute dependency graph (from generated dep-graph.ts). */
  depGraph: AttributeDepGraph;
}

// ── AGNode interface ─────────────────────────────────────────────────

/** The AGNode type — a decorated AST node that implements Ctx. */
export interface AGNodeInterface extends Ctx {
  readonly node: ASTNode;
  readonly parent: AGNodeInterface | undefined;
  readonly children: readonly AGNodeInterface[];
  readonly isRoot: boolean;
  readonly fieldName: string | undefined;
}

/**
 * Type-safe AGNode — narrows `attr()` return types using a generated attr map.
 *
 * Usage:
 *   // M flows through EvaluationTarget → createEvaluatorFromTarget → Evaluator<M, P>
 *   const tree = evaluator.buildTree(root);  // → TypedAGNode<KSCAttrMap> (inferred)
 *   tree.attr('kindDefs')  // → KindDefinition[]  (not any)
 *
 * Parameterized attributes (not in the map) fall through to `any`.
 */
export type TypedAGNode<M> = Omit<AGNodeInterface, 'attr' | 'parent' | 'children'> & {
  attr<K extends string & keyof M>(name: K): M[K];
  attr(name: string, ...args: unknown[]): any;
  readonly parent: TypedAGNode<M> | undefined;
  readonly children: readonly TypedAGNode<M>[];
}
