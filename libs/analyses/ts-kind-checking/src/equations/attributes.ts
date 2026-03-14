/**
 * Equation functions for the kind-checking analysis.
 *
 * Pure functions that compute attribute values at runtime. Each function
 * serves one attribute and is statically imported by the generated evaluator.
 *
 * Dependencies are declared via withDeps() -- compile.ts reads them to build
 * the static dep graph. Function signatures are standardized:
 *   - Non-parameterized: (ctx: Ctx) => T  or  (ctx: KindCtx<KSFoo>) => T
 *   - Parameterized: (ctx: Ctx, param) => T  or  (ctx: KindCtx<KSFoo>, param) => T
 *
 * Per-kind equation functions use KindCtx<N> for type-safe node access:
 *   ctx.node.escapedText  (no cast needed when ctx: KindCtx<KSIdentifier>)
 *
 * Attributes served:
 *   kindDefs         -- KindDefinition[] (syn, on CompilationUnit nodes)
 *   defEnv           -- Map<string, KindDefinition> (inh, propagated from root)
 *   defLookup        -- (name: string) => KindDefinition | undefined (syn)
 *   kindAnnotations  -- KindDefinition[] (syn, on VariableDeclaration nodes)
 *   contextFor       -- KindDefinition | null (inh, parameterized by property)
 *   violationFor     -- Diagnostic | null (syn, per-kind equations by node kind)
 *   allViolations    -- Diagnostic[] (syn, gathers all violations)
 *
 */

import type { Diagnostic } from '../types.js';
import { PROPERTY_KEYS } from '../types.js';
import type { KindDefinition } from '../types.js';
import type {
  KSNode, KSTypeReference,
  KSIdentifier,
  KSVariableDeclaration, KSIntersectionType, KSCompilationUnit,
  KSPropertyAccessExpression, KSVariableDeclarationList,
  KSExpressionStatement, KSBinaryExpression,
  KSPrefixUnaryExpression, KSPostfixUnaryExpression, KSDeleteExpression,
  KSCallExpression, KSTypeAliasDeclaration,
} from '@ksc/language-ts-ast/grammar/index.js';
import type { Ctx, KindCtx } from '@ksc/evaluation/domain/evaluator-index.js';
import { withDeps } from '@ksc/behavior';
import type { TSNodeKind, KindToNode } from '@ksc/language-ts-ast/grammar/index.js';

/**
 * Per-kind equation record: all equations in this record must accept
 * KindCtx narrowed to the given kind. Functions typed with plain Ctx
 * are also accepted (Ctx is wider than KindCtx<N>).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KindEquations<K extends TSNodeKind> = Record<string, ((ctx: KindCtx<KindToNode[K]>, ...args: any[]) => any) & { deps?: string[] }>;

import { getKindCtx, diag, ASSIGNMENT_OPS, IO_MODULES, SIDE_EFFECT_EXPR_KINDS } from './predicates.js';
import { tryExtractKindDef } from './definitions.js';

// ── kindDefs equations ──────────────────────────────────────────────

export const eq_kindDefs_CompilationUnit = withDeps([],
  function eq_kindDefs_CompilationUnit(ctx: KindCtx<KSCompilationUnit>): KindDefinition[] {
    const defs: KindDefinition[] = [];
    const fileName = ctx.findFileName();
    for (const childCtx of ctx.children) {
      if (childCtx.node.kind !== 'TypeAliasDeclaration') continue;
      const def = tryExtractKindDef(childCtx.node as KSTypeAliasDeclaration, fileName);
      if (def) defs.push(def);
    }
    return defs;
  }
);

export const eq_kindDefs_default = withDeps([],
  function eq_kindDefs_default(_ctx: Ctx): KindDefinition[] {
    return [];
  }
);

export const eq_definitions_Program = withDeps(['kindDefs'],
  function eq_definitions_Program(ctx: Ctx): KindDefinition[] {
    const definitions: KindDefinition[] = [];
    for (const child of ctx.children) {
      const kindDefs = child.attr('kindDefs') as KindDefinition[];
      if (kindDefs.length > 0) definitions.push(...kindDefs);
    }
    return definitions;
  },
);

export const eq_definitions_default = withDeps([],
  function eq_definitions_default(_ctx: Ctx): KindDefinition[] {
    return [];
  },
);

// ── defEnv / defLookup equations ────────────────────────────────────

export const eq_defEnv_root = withDeps(['kindDefs'],
  function eq_defEnv_root(ctx: Ctx): Map<string, KindDefinition> {
    const map = new Map<string, KindDefinition>();
    for (const cuCtx of ctx.children) {
      for (const def of cuCtx.attr('kindDefs')) {
        map.set(def.name, def);
      }
    }
    return map;
  }
);

export const eq_defLookup = withDeps(['defEnv'],
  function eq_defLookup(ctx: Ctx): (name: string) => KindDefinition | undefined {
    const env = ctx.attr('defEnv');
    return (name: string) => env.get(name);
  }
);

// ── kindAnnotations equations ───────────────────────────────────────

function extractKindAnnotations(
  typeNode: KSNode,
  defLookup: (name: string) => KindDefinition | undefined,
): KindDefinition[] {
  if (typeNode.kind === 'IntersectionType') {
    const results: KindDefinition[] = [];
    for (const t of (typeNode as KSIntersectionType).types) {
      results.push(...extractKindAnnotations(t, defLookup));
    }
    return results;
  }
  if (typeNode.kind === 'TypeReference') {
    const ref = typeNode as KSTypeReference;
    if (ref.typeName.kind === 'Identifier') {
      const def = defLookup((ref.typeName as KSIdentifier).escapedText);
      if (def) return [def];
    }
  }
  return [];
}

export const eq_kindAnnotations_VariableDeclaration = withDeps(['defLookup'],
  function eq_kindAnnotations_VariableDeclaration(ctx: KindCtx<KSVariableDeclaration>): KindDefinition[] {
    if (!ctx.node.type) return [];
    const defLookup = ctx.attr('defLookup');
    return extractKindAnnotations(ctx.node.type, defLookup);
  }
);

export const eq_kindAnnotations_default = withDeps([],
  function eq_kindAnnotations_default(_ctx: Ctx): KindDefinition[] {
    return [];
  }
);

// ── contextFor equation (inherited, parameterized) ──────────────────

/**
 * Parent equation for contextFor on VariableDeclaration parents.
 * Returns the matching KindDefinition if the parent has a kind annotation
 * with this property, or undefined to fall through to copy-down.
 *
 * Note: This is an inh parentEquation, so `ctx` is the child node (not the parent).
 * The parent is accessed via ctx.parent.
 */
export const eq_contextOverride = withDeps(['kindAnnotations'],
  function eq_contextOverride(ctx: Ctx, property: string): KindDefinition | null | undefined {
    const kinds = ctx.parent!.attr('kindAnnotations') as KindDefinition[];
    const match = kinds.find((k: KindDefinition) => (k.properties as Record<string, boolean | undefined>)[property]);
    return match; // undefined = fall through to copy-down
  }
);

// ── violationFor per-kind equations (synthesized, parameterized) ────

export const eq_violationFor_Identifier = withDeps(['contextFor'],
  function eq_violationFor_Identifier(ctx: KindCtx<KSIdentifier>, property: string): Diagnostic | null {
    const kindCtx = getKindCtx(ctx, property);
    if (!kindCtx) return null;

    if (property === 'noImports' && ctx.node.resolvesToImport) {
      return diag(ctx, kindCtx, property,
        `'${ctx.node.escapedText}' is an imported binding, violating ${kindCtx.name} (noImports)`);
    }
    if (property === 'noIO' && ctx.node.resolvesToImport
        && ctx.node.importModuleSpecifier && IO_MODULES.has(ctx.node.importModuleSpecifier)) {
      return diag(ctx, kindCtx, property,
        `'${ctx.node.escapedText}' from IO module '${ctx.node.importModuleSpecifier}' violates ${kindCtx.name} (noIO)`);
    }
    return null;
  }
);

export const eq_violationFor_PropertyAccessExpression = withDeps(['contextFor'],
  function eq_violationFor_PropertyAccessExpression(ctx: KindCtx<KSPropertyAccessExpression>, property: string): Diagnostic | null {
    const kindCtx = getKindCtx(ctx, property);
    if (!kindCtx) return null;
    if (property !== 'noConsole') return null;
    if (ctx.node.expression.kind === 'Identifier'
        && (ctx.node.expression as KSIdentifier).escapedText === 'console') {
      return diag(ctx, kindCtx, property,
        `'console.${(ctx.node.name as KSIdentifier).escapedText}' violates ${kindCtx.name} (noConsole)`);
    }
    return null;
  }
);

export const eq_violationFor_VariableDeclarationList = withDeps(['contextFor'],
  function eq_violationFor_VariableDeclarationList(ctx: KindCtx<KSVariableDeclarationList>, property: string): Diagnostic | null {
    const kindCtx = getKindCtx(ctx, property);
    if (!kindCtx) return null;
    if (property !== 'immutable') return null;
    if (ctx.node.declarationKind !== 'const') {
      return diag(ctx, kindCtx, property,
        `'${ctx.node.declarationKind}' binding violates ${kindCtx.name} (immutable)`);
    }
    return null;
  }
);

export const eq_violationFor_CallExpression = withDeps(['contextFor'],
  function eq_violationFor_CallExpression(ctx: KindCtx<KSCallExpression>, property: string): Diagnostic | null {
    const kindCtx = getKindCtx(ctx, property);
    if (!kindCtx) return null;
    if (property !== 'static') return null;
    if (ctx.node.expression.kind === 'ImportKeyword') {
      return diag(ctx, kindCtx, property,
        `dynamic import() violates ${kindCtx.name} (static)`);
    }
    return null;
  }
);

export const eq_violationFor_ExpressionStatement = withDeps(['contextFor'],
  function eq_violationFor_ExpressionStatement(ctx: KindCtx<KSExpressionStatement>, property: string): Diagnostic | null {
    const kindCtx = getKindCtx(ctx, property);
    if (!kindCtx) return null;
    if (property !== 'noSideEffects') return null;
    if (SIDE_EFFECT_EXPR_KINDS.has(ctx.node.expression.kind)) {
      return diag(ctx, kindCtx, property,
        `${ctx.node.expression.kind} as statement is a side effect, violating ${kindCtx.name} (noSideEffects)`);
    }
    return null;
  }
);

export const eq_violationFor_BinaryExpression = withDeps(['contextFor'],
  function eq_violationFor_BinaryExpression(ctx: KindCtx<KSBinaryExpression>, property: string): Diagnostic | null {
    const kindCtx = getKindCtx(ctx, property);
    if (!kindCtx) return null;
    if (property !== 'noMutation') return null;
    if (ASSIGNMENT_OPS.has(ctx.node.operatorToken.kind)) {
      return diag(ctx, kindCtx, property,
        `assignment operator '${ctx.node.operatorToken.kind}' violates ${kindCtx.name} (noMutation)`);
    }
    return null;
  }
);

export const eq_violationFor_PrefixUnaryExpression = withDeps(['contextFor'],
  function eq_violationFor_PrefixUnaryExpression(ctx: KindCtx<KSPrefixUnaryExpression>, property: string): Diagnostic | null {
    const kindCtx = getKindCtx(ctx, property);
    if (!kindCtx) return null;
    if (property !== 'noMutation') return null;
    if (ctx.node.operator === '++' || ctx.node.operator === '--') {
      return diag(ctx, kindCtx, property,
        `prefix '${ctx.node.operator}' violates ${kindCtx.name} (noMutation)`);
    }
    return null;
  }
);

export const eq_violationFor_PostfixUnaryExpression = withDeps(['contextFor'],
  function eq_violationFor_PostfixUnaryExpression(ctx: KindCtx<KSPostfixUnaryExpression>, property: string): Diagnostic | null {
    const kindCtx = getKindCtx(ctx, property);
    if (!kindCtx) return null;
    if (property !== 'noMutation') return null;
    if (ctx.node.operator === '++' || ctx.node.operator === '--') {
      return diag(ctx, kindCtx, property,
        `postfix '${ctx.node.operator}' violates ${kindCtx.name} (noMutation)`);
    }
    return null;
  }
);

export const eq_violationFor_DeleteExpression = withDeps(['contextFor'],
  function eq_violationFor_DeleteExpression(ctx: KindCtx<KSDeleteExpression>, property: string): Diagnostic | null {
    const kindCtx = getKindCtx(ctx, property);
    if (!kindCtx) return null;
    if (property !== 'noMutation') return null;
    return diag(ctx, kindCtx, property,
      `'delete' violates ${kindCtx.name} (noMutation)`);
  }
);

// ── allViolations equation (synthesized) ─────────────────────────────

/**
 * Gather all violation diagnostics from this node and all descendants.
 * Checks violationFor(p) for each property, then recurses into children.
 */
export const eq_allViolations = withDeps(['violationFor'],
  function eq_allViolations(ctx: Ctx): Diagnostic[] {
    const result: Diagnostic[] = [];
    for (const propName of PROPERTY_KEYS) {
      const v = ctx.attr('violationFor', propName) as Diagnostic | null;
      if (v) result.push(v);
    }
    for (const child of ctx.children) {
      const childViolations = child.attr('allViolations') as Diagnostic[];
      if (childViolations.length > 0) {
        result.push(...childViolations);
      }
    }
    return result;
  }
);

export const eq_diagnostics_Program = withDeps(['allViolations', 'allProtobufViolations'],
  function eq_diagnostics_Program(ctx: Ctx): Diagnostic[] {
    return [
      ...(ctx.attr('allViolations') as Diagnostic[]),
      ...(ctx.attr('allProtobufViolations') as Diagnostic[]),
    ];
  },
);

export const eq_diagnostics_default = withDeps([],
  function eq_diagnostics_default(_ctx: Ctx): Diagnostic[] {
    return [];
  },
);

// ── Per-kind equation objects (production-centric view) ──────────────
//
// Groups equations by the node kind they handle. Used by spec.ts with
// pivotToAttrCentric() to build the attr-centric AttrDecl format.
// Individual equation functions above remain exported for auto-import.

export const CompilationUnitEquations = {
  kindDefs: eq_kindDefs_CompilationUnit,
} satisfies KindEquations<'CompilationUnit'>;

export const VariableDeclarationEquations = {
  kindAnnotations: eq_kindAnnotations_VariableDeclaration,
  contextFor: eq_contextOverride,
} satisfies KindEquations<'VariableDeclaration'>;

export const IdentifierEquations = {
  violationFor: eq_violationFor_Identifier,
} satisfies KindEquations<'Identifier'>;

export const PropertyAccessExpressionEquations = {
  violationFor: eq_violationFor_PropertyAccessExpression,
} satisfies KindEquations<'PropertyAccessExpression'>;

export const VariableDeclarationListEquations = {
  violationFor: eq_violationFor_VariableDeclarationList,
} satisfies KindEquations<'VariableDeclarationList'>;

export const CallExpressionEquations = {
  violationFor: eq_violationFor_CallExpression,
} satisfies KindEquations<'CallExpression'>;

export const ExpressionStatementEquations = {
  violationFor: eq_violationFor_ExpressionStatement,
} satisfies KindEquations<'ExpressionStatement'>;

export const BinaryExpressionEquations = {
  violationFor: eq_violationFor_BinaryExpression,
} satisfies KindEquations<'BinaryExpression'>;

export const PrefixUnaryExpressionEquations = {
  violationFor: eq_violationFor_PrefixUnaryExpression,
} satisfies KindEquations<'PrefixUnaryExpression'>;

export const PostfixUnaryExpressionEquations = {
  violationFor: eq_violationFor_PostfixUnaryExpression,
} satisfies KindEquations<'PostfixUnaryExpression'>;

export const DeleteExpressionEquations = {
  violationFor: eq_violationFor_DeleteExpression,
} satisfies KindEquations<'DeleteExpression'>;
