/**
 * Equation functions for the kind-checking analysis.
 *
 * Pure functions that compute attribute values at runtime. Each function
 * serves one attribute and is statically imported by the generated evaluator.
 *
 * Dependencies are declared via withDeps() — compile.ts reads them to build
 * the static dep graph. Function signatures are standardized:
 *   - Non-parameterized: (ctx: Ctx) => T
 *   - Parameterized: (ctx: Ctx, param: ParamType) => T
 *
 * Attributes served:
 *   kindDefs         — KindDefinition[] (syn, on CompilationUnit nodes)
 *   defEnv           — Map<string, KindDefinition> (inh, propagated from root)
 *   defLookup        — (name: string) => KindDefinition | undefined (syn)
 *   kindAnnotations  — KindDefinition[] (syn, on VariableDeclaration nodes)
 *   contextFor       — KindDefinition | null (inh, parameterized by property)
 *   violationFor     — Diagnostic | null (syn, per-kind equations by node kind)
 *   allViolations    — Diagnostic[] (syn, gathers all violations)
 *
 * Also exports the `definitions` projection function and resetCounter().
 */

import type { PropertySet, Diagnostic } from './types.js';
import { PROPERTY_KEYS } from './types.js';
import type { KindDefinition, DefIdCounter } from './types.js';
import type {
  KSNode, KSTypeAliasDeclaration, KSTypeReference,
  KSTypeLiteral, KSIdentifier, KSPropertySignature,
  KSVariableDeclaration, KSIntersectionType,
  KSPropertyAccessExpression, KSVariableDeclarationList,
  KSExpressionStatement, KSBinaryExpression,
  KSPrefixUnaryExpression, KSPostfixUnaryExpression,
} from '../../../generated/ts-ast/grammar/index.js';
import type { Ctx } from '../../../analysis/ctx.js';
import { withDeps } from '../../../analysis/types.js';

// ── Module-level counter (closure — no longer passed as parameter) ───

let _counter: DefIdCounter = { value: 0 };

/** Reset the definition ID counter. Called by the generated evaluator before each evaluation. */
export function resetCounter(): void {
  _counter = { value: 0 };
}

// ── Violation predicate constants ────────────────────────────────────

const ASSIGNMENT_OPS = new Set([
  'EqualsToken', 'PlusEqualsToken', 'MinusEqualsToken',
  'AsteriskEqualsToken', 'SlashEqualsToken', 'PercentEqualsToken',
  'AmpersandEqualsToken', 'BarEqualsToken', 'CaretEqualsToken',
  'LessThanLessThanEqualsToken', 'GreaterThanGreaterThanEqualsToken',
  'GreaterThanGreaterThanGreaterThanEqualsToken',
  'AsteriskAsteriskEqualsToken',
  'BarBarEqualsToken', 'AmpersandAmpersandEqualsToken',
  'QuestionQuestionEqualsToken',
]);

const IO_MODULES = new Set([
  'fs', 'fs/promises', 'path', 'net', 'http', 'https',
  'child_process', 'cluster', 'dgram', 'dns', 'tls',
  'crypto', 'zlib', 'stream', 'readline', 'worker_threads',
  'node:fs', 'node:fs/promises', 'node:path', 'node:net',
  'node:http', 'node:https', 'node:child_process', 'node:cluster',
  'node:dgram', 'node:dns', 'node:tls', 'node:crypto', 'node:zlib',
  'node:stream', 'node:readline', 'node:worker_threads',
]);

const SIDE_EFFECT_EXPR_KINDS = new Set([
  'CallExpression', 'AwaitExpression', 'YieldExpression',
]);

// ── Violation helpers ────────────────────────────────────────────────

function getKindCtx(ctx: Ctx, property: string): KindDefinition | null {
  return ctx.attr('contextFor', property) as KindDefinition | null;
}

function diag(ctx: Ctx, def: KindDefinition, property: string, message: string): Diagnostic {
  return {
    node: ctx.node,
    message,
    kindName: def.name,
    property,
    pos: (ctx.node as any).pos,
    end: (ctx.node as any).end,
    fileName: ctx.findFileName(),
  };
}

// ── Definition extraction helpers ───────────────────────────────────

function extractPropertiesFromTypeLiteral(node: KSTypeLiteral): PropertySet {
  const props: Record<string, unknown> = {};

  for (const member of node.members) {
    if (member.kind !== 'PropertySignature') continue;
    const sig = member as KSPropertySignature;
    if (sig.name.kind !== 'Identifier') continue;
    const name = (sig.name as KSIdentifier).escapedText;
    if (!PROPERTY_KEYS.has(name)) continue;

    if (!sig.type) continue;

    if ((sig.type as KSNode).kind === 'TrueKeyword') {
      props[name] = true;
    } else if (sig.type.kind === 'LiteralType') {
      const litType = sig.type as { children: KSNode[] };
      if (litType.children.length > 0 && litType.children[0].kind === 'TrueKeyword') {
        props[name] = true;
      }
    }
  }

  return props as PropertySet;
}

function tryExtractKindDef(
  node: KSTypeAliasDeclaration,
  counter: DefIdCounter,
): KindDefinition | undefined {
  if (node.type.kind !== 'TypeReference') return undefined;
  const typeRef = node.type as KSTypeReference;

  if (typeRef.typeName.kind !== 'Identifier') return undefined;
  if ((typeRef.typeName as KSIdentifier).escapedText !== 'Kind') return undefined;

  if (typeRef.typeArguments.length !== 1) return undefined;
  const arg = typeRef.typeArguments[0];
  if (arg.kind !== 'TypeLiteral') return undefined;

  const properties = extractPropertiesFromTypeLiteral(arg as KSTypeLiteral);

  return {
    id: `kdef-${counter.value++}`,
    name: node.name.escapedText,
    properties: properties as Record<string, boolean | undefined>,
    node,
  };
}

// ── kindDefs equations ──────────────────────────────────────────────

export const eq_kindDefs_CompilationUnit = withDeps([],
  function eq_kindDefs_CompilationUnit(ctx: Ctx): KindDefinition[] {
    const defs: KindDefinition[] = [];
    for (const childCtx of ctx.children) {
      if ((childCtx.node as any).kind !== 'TypeAliasDeclaration') continue;
      const def = tryExtractKindDef(childCtx.node as KSTypeAliasDeclaration, _counter);
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
  function eq_kindAnnotations_VariableDeclaration(ctx: Ctx): KindDefinition[] {
    const varDecl = ctx.node as KSVariableDeclaration;
    if (!varDecl.type) return [];
    const defLookup = ctx.attr('defLookup');
    return extractKindAnnotations(varDecl.type, defLookup);
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
 */
export const eq_contextOverride = withDeps(['kindAnnotations'],
  function eq_contextOverride(ctx: Ctx, property: string): KindDefinition | null | undefined {
    const kinds = ctx.parent!.attr('kindAnnotations') as KindDefinition[];
    const match = kinds.find((k: KindDefinition) => (k.properties as any)[property]);
    return match; // undefined = fall through to copy-down
  }
);

// ── violationFor per-kind equations (synthesized, parameterized) ────

export const eq_violationFor_Identifier = withDeps(['contextFor'],
  function eq_violationFor_Identifier(ctx: Ctx, property: string): Diagnostic | null {
    const kindCtx = getKindCtx(ctx, property);
    if (!kindCtx) return null;
    const node = ctx.node as KSIdentifier;

    if (property === 'noImports' && node.resolvesToImport) {
      return diag(ctx, kindCtx, property,
        `'${node.escapedText}' is an imported binding, violating ${kindCtx.name} (noImports)`);
    }
    if (property === 'noIO' && node.resolvesToImport
        && node.importModuleSpecifier && IO_MODULES.has(node.importModuleSpecifier)) {
      return diag(ctx, kindCtx, property,
        `'${node.escapedText}' from IO module '${node.importModuleSpecifier}' violates ${kindCtx.name} (noIO)`);
    }
    return null;
  }
);

export const eq_violationFor_PropertyAccessExpression = withDeps(['contextFor'],
  function eq_violationFor_PropertyAccessExpression(ctx: Ctx, property: string): Diagnostic | null {
    const kindCtx = getKindCtx(ctx, property);
    if (!kindCtx) return null;
    if (property !== 'noConsole') return null;
    const node = ctx.node as KSPropertyAccessExpression;
    if (node.expression.kind === 'Identifier'
        && (node.expression as KSIdentifier).escapedText === 'console') {
      return diag(ctx, kindCtx, property,
        `'console.${(node.name as KSIdentifier).escapedText}' violates ${kindCtx.name} (noConsole)`);
    }
    return null;
  }
);

export const eq_violationFor_VariableDeclarationList = withDeps(['contextFor'],
  function eq_violationFor_VariableDeclarationList(ctx: Ctx, property: string): Diagnostic | null {
    const kindCtx = getKindCtx(ctx, property);
    if (!kindCtx) return null;
    if (property !== 'immutable') return null;
    const node = ctx.node as KSVariableDeclarationList;
    if (node.declarationKind !== 'const') {
      return diag(ctx, kindCtx, property,
        `'${node.declarationKind}' binding violates ${kindCtx.name} (immutable)`);
    }
    return null;
  }
);

export const eq_violationFor_CallExpression = withDeps(['contextFor'],
  function eq_violationFor_CallExpression(ctx: Ctx, property: string): Diagnostic | null {
    const kindCtx = getKindCtx(ctx, property);
    if (!kindCtx) return null;
    if (property !== 'static') return null;
    if ((ctx.node as any).expression?.kind === 'ImportKeyword') {
      return diag(ctx, kindCtx, property,
        `dynamic import() violates ${kindCtx.name} (static)`);
    }
    return null;
  }
);

export const eq_violationFor_ExpressionStatement = withDeps(['contextFor'],
  function eq_violationFor_ExpressionStatement(ctx: Ctx, property: string): Diagnostic | null {
    const kindCtx = getKindCtx(ctx, property);
    if (!kindCtx) return null;
    if (property !== 'noSideEffects') return null;
    const node = ctx.node as KSExpressionStatement;
    if (SIDE_EFFECT_EXPR_KINDS.has(node.expression.kind)) {
      return diag(ctx, kindCtx, property,
        `${node.expression.kind} as statement is a side effect, violating ${kindCtx.name} (noSideEffects)`);
    }
    return null;
  }
);

export const eq_violationFor_BinaryExpression = withDeps(['contextFor'],
  function eq_violationFor_BinaryExpression(ctx: Ctx, property: string): Diagnostic | null {
    const kindCtx = getKindCtx(ctx, property);
    if (!kindCtx) return null;
    if (property !== 'noMutation') return null;
    const node = ctx.node as KSBinaryExpression;
    if (ASSIGNMENT_OPS.has(node.operatorToken.kind)) {
      return diag(ctx, kindCtx, property,
        `assignment operator '${node.operatorToken.kind}' violates ${kindCtx.name} (noMutation)`);
    }
    return null;
  }
);

export const eq_violationFor_PrefixUnaryExpression = withDeps(['contextFor'],
  function eq_violationFor_PrefixUnaryExpression(ctx: Ctx, property: string): Diagnostic | null {
    const kindCtx = getKindCtx(ctx, property);
    if (!kindCtx) return null;
    if (property !== 'noMutation') return null;
    const node = ctx.node as KSPrefixUnaryExpression;
    if (node.operator === '++' || node.operator === '--') {
      return diag(ctx, kindCtx, property,
        `prefix '${node.operator}' violates ${kindCtx.name} (noMutation)`);
    }
    return null;
  }
);

export const eq_violationFor_PostfixUnaryExpression = withDeps(['contextFor'],
  function eq_violationFor_PostfixUnaryExpression(ctx: Ctx, property: string): Diagnostic | null {
    const kindCtx = getKindCtx(ctx, property);
    if (!kindCtx) return null;
    if (property !== 'noMutation') return null;
    const node = ctx.node as KSPostfixUnaryExpression;
    if (node.operator === '++' || node.operator === '--') {
      return diag(ctx, kindCtx, property,
        `postfix '${node.operator}' violates ${kindCtx.name} (noMutation)`);
    }
    return null;
  }
);

export const eq_violationFor_DeleteExpression = withDeps(['contextFor'],
  function eq_violationFor_DeleteExpression(ctx: Ctx, property: string): Diagnostic | null {
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
    const violations: Diagnostic[] = [];
    for (const propName of PROPERTY_KEYS) {
      const v = ctx.attr('violationFor', propName) as Diagnostic | null;
      if (v) violations.push(v);
    }
    let result: Diagnostic[] = violations;
    for (const child of ctx.children) {
      const childViolations = child.attr('allViolations') as Diagnostic[];
      if (childViolations.length > 0) {
        result = result.length === 0 ? childViolations : [...result, ...childViolations];
      }
    }
    return result;
  }
);

// ── Projection ──────────────────────────────────────────────────────

export function projectDefinitions(root: Ctx): KindDefinition[] {
  const allDefs: KindDefinition[] = [];
  for (const cuCtx of root.children) {
    allDefs.push(...cuCtx.attr('kindDefs'));
  }
  return allDefs;
}
