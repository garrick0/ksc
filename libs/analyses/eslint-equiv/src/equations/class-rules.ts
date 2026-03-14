/**
 * Phase 8 — Class structure synthesized equations.
 *
 * Rules targeting class declarations: duplicate members, useless constructors,
 * empty static blocks.
 */

import type { EslintEquivDiagnostic } from '../types.js';
import type { KindCtx, Ctx } from '@ksc/evaluation/domain/evaluator-index.js';
import type { KSNode, KSNodeBase, KSIdentifier } from '@ksc/language-ts-ast/grammar/index.js';
import { withDeps } from '@ksc/behavior';
import { eslintDiag } from './helpers.js';

// ── no-dupe-class-members ───────────────────────────────────────────

function getMemberName(member: KSNodeBase): string | undefined {
  const name = member.name as KSNodeBase | undefined;
  if (!name) return undefined;
  if (name.kind === 'Identifier') return (name as KSIdentifier).escapedText;
  if (name.kind === 'StringLiteral') return name.value as string;
  if (name.kind === 'NumericLiteral') return String(name.value);
  if (name.kind === 'ComputedPropertyName') return undefined; // dynamic
  return undefined;
}

function getMemberType(member: KSNodeBase): string {
  if (member.kind === 'GetAccessor') return 'get';
  if (member.kind === 'SetAccessor') return 'set';
  return 'other';
}

export const eq_noDupeClassMembersViolation_ClassDeclaration = withDeps([],
  function eq_noDupeClassMembersViolation_ClassDeclaration(
    ctx: Ctx,
  ): EslintEquivDiagnostic[] {
    const violations: EslintEquivDiagnostic[] = [];
    // Track seen: key = name + isStatic, value = set of member types
    const seen = new Map<string, Set<string>>();

    const members = (ctx.node as KSNode).members as KSNodeBase[] | undefined;
    if (!members) return [];

    for (const member of members) {
      const name = getMemberName(member);
      if (name === undefined) continue;

      const modifiers = member.modifiers as KSNodeBase[] | undefined;
      const isStatic = modifiers?.some((m) => m.kind === 'StaticKeyword') ?? false;
      const key = `${isStatic ? 'static:' : ''}${name}`;
      const memberType = getMemberType(member);

      const existing = seen.get(key);
      if (existing) {
        // get + set is allowed (accessor pair), but duplicate get/get or method/method is not
        if (memberType === 'other' || existing.has(memberType)) {
          violations.push(eslintDiag(
            ctx as KindCtx<KSNode>, 'no-dupe-class-members',
            `Duplicate name '${name}'.`,
            member.pos, member.end,
          ));
        }
        existing.add(memberType);
      } else {
        seen.set(key, new Set([memberType]));
      }
    }

    return violations;
  },
);

// Also handle ClassExpression
export const eq_noDupeClassMembersViolation_ClassExpression = withDeps([],
  function eq_noDupeClassMembersViolation_ClassExpression(
    ctx: Ctx,
  ): EslintEquivDiagnostic[] {
    // Reuse ClassDeclaration logic — same node shape
    return eq_noDupeClassMembersViolation_ClassDeclaration(ctx);
  },
);

// ── no-useless-constructor ──────────────────────────────────────────

export const eq_noUselessConstructorViolation_Constructor = withDeps([],
  function eq_noUselessConstructorViolation_Constructor(
    ctx: Ctx,
  ): EslintEquivDiagnostic | null {
    const ctxNode = ctx.node as KSNode;
    const body = ctxNode.body as KSNodeBase | undefined;
    if (!body || body.kind !== 'Block') return null;

    const stmts = body.statements as KSNodeBase[] | undefined;
    if (!stmts) return null;

    const params = ctxNode.parameters as KSNodeBase[] | undefined;

    // Case 1: completely empty constructor with no params
    if (stmts.length === 0 && (!params || params.length === 0)) {
      return eslintDiag(ctx as KindCtx<KSNode>, 'no-useless-constructor',
        'Useless constructor.');
    }

    // Case 2: constructor that only calls super(...args) with same args as params
    if (stmts.length === 1) {
      const stmt = stmts[0];
      if (stmt.kind !== 'ExpressionStatement') return null;
      const expr = stmt.expression as KSNodeBase | undefined;
      if (!expr || expr.kind !== 'CallExpression') return null;
      if ((expr.expression as KSNodeBase | undefined)?.kind !== 'SuperKeyword') return null;

      // Check params don't have modifiers (parameter properties like `private x`)
      if (params?.some((p) => { const mods = p.modifiers as unknown[] | undefined; return mods && mods.length > 0; })) return null;

      const callArgs = expr.arguments as KSNodeBase[] | undefined;
      if (!params || !callArgs) return null;
      if (params.length !== callArgs.length) return null;

      // Check each arg is just the corresponding param identifier
      const allMatch = params.every((param, i) => {
        const arg = callArgs[i];
        if (!arg || arg.kind !== 'Identifier') return false;
        const paramName = param.name as KSNodeBase | undefined;
        if (!paramName || paramName.kind !== 'Identifier') return false;
        return (arg as KSIdentifier).escapedText === (paramName as KSIdentifier).escapedText;
      });

      if (allMatch) {
        return eslintDiag(ctx as KindCtx<KSNode>, 'no-useless-constructor',
          'Useless constructor.');
      }
    }

    return null;
  },
);

// ── no-empty-static-block ───────────────────────────────────────────

export const eq_noEmptyStaticBlockViolation_ClassStaticBlockDeclaration = withDeps([],
  function eq_noEmptyStaticBlockViolation_ClassStaticBlockDeclaration(
    ctx: Ctx,
  ): EslintEquivDiagnostic | null {
    const body = (ctx.node as KSNode).body as KSNodeBase | undefined;
    if (!body || body.kind !== 'Block') return null;

    const stmts = body.statements as KSNodeBase[] | undefined;
    if (!stmts || stmts.length === 0) {
      return eslintDiag(ctx as KindCtx<KSNode>, 'no-empty-static-block',
        'Unexpected empty static block.');
    }
    return null;
  },
);
