/**
 * Evaluator types — port interfaces for the AG evaluator engine.
 *
 * Ports defined here:
 *   - DispatchConfig          — what generated dispatch provides (per-attribute routing)
 *   - EvaluatorConfig<P>      — how the evaluator is assembled at composition roots
 *   - AGNodeInterface         — the decorated AST node contract
 *   - TypedAGNode<M>          — type-safe attribute access
 *   - EvaluationTarget<K,P>   — named shape for wireEvaluator input (K-linked)
 *
 * The evaluator is parameterized by dispatch functions (generated) and
 * grammar/spec metadata (from specs). This module defines the shapes
 * that connect those pieces.
 */

import type { Ctx, AnalysisSpec } from '../analysis/index.js';
import type { ASTNode, Grammar } from '../grammar/index.js';

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
  /** Compute parent override. Returns undefined for copy-down. Called with (ctx) or (ctx, param). */
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

export interface EvaluatorConfig<K extends string = string, P extends Record<string, unknown> = Record<string, unknown>> {
  /** Per-attribute dispatch (from generated dispatch.ts). */
  dispatch: DispatchConfig;
  /** Grammar — provides fieldDefs for tree building and rootKind/fileNameField for structural queries. */
  grammar: Grammar<K>;
  /** Projection functions: extract final results from evaluated root. Typed by P. */
  projections: { [Key in keyof P]: (root: Ctx) => P[Key] };
  /** Optional setup function called before each evaluation (e.g., resetCounter). */
  setup?: () => void;
}

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
 *   import type { KSCAttrMap } from '../generated/ts-ast/kind-checking/attr-types.js';
 *   const tree = evaluator.buildTree(root) as TypedAGNode<KSCAttrMap>;
 *   tree.attr('kindDefs')  // → KindDefinition[]  (not any)
 *
 * Parameterized attributes (not in the map) fall through to `any`.
 */
export type TypedAGNode<M extends Record<string, unknown>> = Omit<AGNodeInterface, 'attr' | 'parent' | 'children'> & {
  attr<K extends string & keyof M>(name: K): M[K];
  attr(name: string, ...args: unknown[]): any;
  readonly parent: TypedAGNode<M> | undefined;
  readonly children: readonly TypedAGNode<M>[];
}

// ── Evaluation Target (named shape for wireEvaluator's input) ──

/**
 * Evaluation target — the three pieces needed to wire an evaluator.
 *
 * Named interface for the ad-hoc object previously passed to wireEvaluator.
 * K-linking ensures grammar and spec are from the same target.
 */
export interface EvaluationTarget<K extends string = string, P extends Record<string, unknown> = Record<string, unknown>> {
  grammar: Grammar<K>;
  spec: AnalysisSpec<K, P>;
  dispatch: DispatchConfig;
}

