/**
 * Scope equations — inherited shadowEnv/shadowDepth + syn noShadowViolation.
 *
 * shadowDepth (inh): scope nesting level, incremented at scope boundaries.
 * shadowEnv (inh): Map<name, depth> tracking all enclosing declarations.
 *   First-occurrence wins: once a name is recorded at depth D, deeper scopes
 *   do not overwrite it — this lets the syn check compare current depth vs
 *   original definition depth.
 * noShadowViolation (syn): fires when a declaration shadows an outer scope name.
 */

import type { EslintEquivDiagnostic } from '../types.js';
import type { KindCtx, Ctx } from '@ksc/evaluation/domain/evaluator-index.js';
import type { KSNode, KSNodeBase, KSIdentifier } from '@ksc/language-ts-ast/grammar/index.js';
import { withDeps } from '@ksc/behavior';
import { eslintDiag } from './helpers.js';

// ── Helpers ──────────────────────────────────────────────────────────

/** Extract simple identifier name from a binding (skip destructuring). */
function getBindingName(nameNode: KSNodeBase | undefined): string | undefined {
  if (nameNode?.kind === 'Identifier') return (nameNode as KSIdentifier).escapedText;
  return undefined;
}

/** Build a new env by adding names (first-occurrence wins). */
function extendEnv(
  base: ReadonlyMap<string, number>,
  names: Array<{ name: string; depth: number }>,
): Map<string, number> | undefined {
  if (names.length === 0) return undefined;
  const newEnv = new Map(base);
  let changed = false;
  for (const { name, depth } of names) {
    if (!newEnv.has(name)) {
      newEnv.set(name, depth);
      changed = true;
    }
  }
  return changed ? newEnv : undefined;
}

// ── shadowDepth (inherited) ──────────────────────────────────────────

/** Shared parent equation: increment depth for all children of scope-creating nodes. */
export const eq_shadowDepth_scopeCreator = withDeps([],
  function eq_shadowDepth_scopeCreator(ctx: Ctx): number | undefined {
    return (ctx.parent!.attr('shadowDepth') as number) + 1;
  },
);

// ── shadowEnv (inherited) ────────────────────────────────────────────

/** Block-like (CompilationUnit, Block): scan direct children for declarations. */
export const eq_shadowEnv_blockLike = withDeps([],
  function eq_shadowEnv_blockLike(ctx: Ctx): Map<string, number> | undefined {
    const parent = ctx.parent!;
    const baseEnv = parent.attr('shadowEnv') as Map<string, number>;
    const newDepth = (parent.attr('shadowDepth') as number) + 1;

    const names: Array<{ name: string; depth: number }> = [];
    for (const child of parent.children) {
      const node = child.node as unknown as KSNodeBase;
      if (node.kind === 'VariableStatement') {
        const declList = node.declarationList as KSNodeBase | undefined;
        if (declList) {
          const declarations = declList.declarations as KSNodeBase[] | undefined;
          if (declarations) {
            for (const decl of declarations) {
              const n = getBindingName(decl.name as KSNodeBase | undefined);
              if (n) names.push({ name: n, depth: newDepth });
            }
          }
        }
      } else if (node.kind === 'FunctionDeclaration' && node.name) {
        const n = getBindingName(node.name as KSNodeBase | undefined);
        if (n) names.push({ name: n, depth: newDepth });
      } else if (node.kind === 'ClassDeclaration' && node.name) {
        const n = getBindingName(node.name as KSNodeBase | undefined);
        if (n) names.push({ name: n, depth: newDepth });
      }
    }

    return extendEnv(baseEnv, names);
  },
);

/** Function-like: add parameters (only for body child). */
export const eq_shadowEnv_functionLike = withDeps([],
  function eq_shadowEnv_functionLike(ctx: Ctx): Map<string, number> | undefined {
    if (ctx.fieldName !== 'body') return undefined;

    const parent = ctx.parent!;
    const baseEnv = parent.attr('shadowEnv') as Map<string, number>;
    const newDepth = (parent.attr('shadowDepth') as number) + 1;

    const names: Array<{ name: string; depth: number }> = [];
    const parentNode = parent.node as unknown as KSNodeBase;
    const params = parentNode.parameters as KSNodeBase[] | undefined;
    if (params) {
      for (const param of params) {
        const n = getBindingName(param.name as KSNodeBase | undefined);
        if (n) names.push({ name: n, depth: newDepth });
      }
    }
    // FunctionExpression: also add the function's own name if present
    if (parent.node.kind === 'FunctionExpression') {
      const n = getBindingName(parentNode.name as KSNodeBase | undefined);
      if (n) names.push({ name: n, depth: newDepth });
    }

    return extendEnv(baseEnv, names);
  },
);

/** CatchClause: add catch variable. */
export const eq_shadowEnv_catchClause = withDeps([],
  function eq_shadowEnv_catchClause(ctx: Ctx): Map<string, number> | undefined {
    const parent = ctx.parent!;
    const baseEnv = parent.attr('shadowEnv') as Map<string, number>;
    const newDepth = (parent.attr('shadowDepth') as number) + 1;

    const catchVar = (parent.node as unknown as KSNodeBase).variableDeclaration as KSNodeBase | undefined;
    if (!catchVar) return undefined;
    const n = getBindingName(catchVar.name as KSNodeBase | undefined);
    if (!n) return undefined;

    return extendEnv(baseEnv, [{ name: n, depth: newDepth }]);
  },
);

/** For-like: add initializer declarations. */
export const eq_shadowEnv_forLike = withDeps([],
  function eq_shadowEnv_forLike(ctx: Ctx): Map<string, number> | undefined {
    const parent = ctx.parent!;
    const baseEnv = parent.attr('shadowEnv') as Map<string, number>;
    const newDepth = (parent.attr('shadowDepth') as number) + 1;

    const initChild = parent.children.find(c => c.fieldName === 'initializer');
    if (!initChild) return undefined;
    const initNode = initChild.node as unknown as KSNodeBase;
    if (initNode.kind !== 'VariableDeclarationList') return undefined;

    const names: Array<{ name: string; depth: number }> = [];
    const declarations = initNode.declarations as KSNodeBase[] | undefined;
    if (declarations) {
      for (const decl of declarations) {
        const n = getBindingName(decl.name as KSNodeBase | undefined);
        if (n) names.push({ name: n, depth: newDepth });
      }
    }

    return extendEnv(baseEnv, names);
  },
);

// ── noShadowViolation (synthesized) ──────────────────────────────────

/** Shared check: is the declared name already in env at a shallower depth? */
function checkShadow(
  ctx: Ctx,
  nameNode: KSNodeBase | undefined,
): EslintEquivDiagnostic | null {
  if (!nameNode) return null;
  const declName = getBindingName(nameNode);
  if (!declName) return null;

  const env = ctx.attr('shadowEnv') as Map<string, number>;
  const depth = ctx.attr('shadowDepth') as number;

  const existingDepth = env.get(declName);
  if (existingDepth !== undefined && existingDepth < depth) {
    return eslintDiag(
      ctx as KindCtx<KSNode>, 'no-shadow',
      `'${declName}' is already declared in the upper scope.`,
      nameNode.pos, nameNode.end,
    );
  }
  return null;
}

export const eq_noShadowViolation_VariableDeclaration = withDeps(['shadowEnv', 'shadowDepth'],
  function eq_noShadowViolation_VariableDeclaration(
    ctx: KindCtx<KSNode>,
  ): EslintEquivDiagnostic | null {
    return checkShadow(ctx, ctx.node.name as KSNodeBase | undefined);
  },
);

export const eq_noShadowViolation_Parameter = withDeps(['shadowEnv', 'shadowDepth'],
  function eq_noShadowViolation_Parameter(
    ctx: KindCtx<KSNode>,
  ): EslintEquivDiagnostic | null {
    return checkShadow(ctx, ctx.node.name as KSNodeBase | undefined);
  },
);

export const eq_noShadowViolation_FunctionDeclaration = withDeps(['shadowEnv', 'shadowDepth'],
  function eq_noShadowViolation_FunctionDeclaration(
    ctx: KindCtx<KSNode>,
  ): EslintEquivDiagnostic | null {
    return checkShadow(ctx, ctx.node.name as KSNodeBase | undefined);
  },
);

export const eq_noShadowViolation_ClassDeclaration = withDeps(['shadowEnv', 'shadowDepth'],
  function eq_noShadowViolation_ClassDeclaration(
    ctx: KindCtx<KSNode>,
  ): EslintEquivDiagnostic | null {
    return checkShadow(ctx, ctx.node.name as KSNodeBase | undefined);
  },
);
