/**
 * Phase 8 — Class structure synthesized equations.
 *
 * Rules targeting class declarations: duplicate members, useless constructors,
 * empty static blocks.
 */

import type { EslintEquivDiagnostic } from '../types.js';
import type { KindCtx, Ctx } from '@kindscript/core-evaluator';
import type { KSNode } from '../../../../grammar/grammar/ts-ast/index.js';
import { withDeps } from '@kindscript/core-codegen';
import { eslintDiag } from './helpers.js';

// ── no-dupe-class-members ───────────────────────────────────────────

function getMemberName(member: any): string | undefined {
  const name = member.name;
  if (!name) return undefined;
  if (name.kind === 'Identifier') return name.escapedText;
  if (name.kind === 'StringLiteral') return name.value;
  if (name.kind === 'NumericLiteral') return String(name.value);
  if (name.kind === 'ComputedPropertyName') return undefined; // dynamic
  return undefined;
}

function getMemberType(member: any): string {
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

    const members = (ctx.node as any).members as any[] | undefined;
    if (!members) return [];

    for (const member of members) {
      const name = getMemberName(member);
      if (name === undefined) continue;

      const isStatic = member.modifiers?.some((m: any) => m.kind === 'StaticKeyword') ?? false;
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
    return eq_noDupeClassMembersViolation_ClassDeclaration.fn(ctx as any);
  },
);

// ── no-useless-constructor ──────────────────────────────────────────

export const eq_noUselessConstructorViolation_Constructor = withDeps([],
  function eq_noUselessConstructorViolation_Constructor(
    ctx: Ctx,
  ): EslintEquivDiagnostic | null {
    const body = (ctx.node as any).body;
    if (!body || body.kind !== 'Block') return null;

    const stmts = body.statements as any[] | undefined;
    if (!stmts) return null;

    const params = (ctx.node as any).parameters as any[] | undefined;

    // Case 1: completely empty constructor with no params
    if (stmts.length === 0 && (!params || params.length === 0)) {
      return eslintDiag(ctx as KindCtx<KSNode>, 'no-useless-constructor',
        'Useless constructor.');
    }

    // Case 2: constructor that only calls super(...args) with same args as params
    if (stmts.length === 1) {
      const stmt = stmts[0];
      if (stmt.kind !== 'ExpressionStatement') return null;
      const expr = stmt.expression;
      if (!expr || expr.kind !== 'CallExpression') return null;
      if (expr.expression?.kind !== 'SuperKeyword') return null;

      // Check params don't have modifiers (parameter properties like `private x`)
      if (params?.some((p: any) => p.modifiers && p.modifiers.length > 0)) return null;

      const callArgs = expr.arguments as any[] | undefined;
      if (!params || !callArgs) return null;
      if (params.length !== callArgs.length) return null;

      // Check each arg is just the corresponding param identifier
      const allMatch = params.every((param: any, i: number) => {
        const arg = callArgs[i];
        if (!arg || arg.kind !== 'Identifier') return false;
        const paramName = param.name;
        if (!paramName || paramName.kind !== 'Identifier') return false;
        return arg.escapedText === paramName.escapedText;
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
    const body = (ctx.node as any).body;
    if (!body || body.kind !== 'Block') return null;

    const stmts = body.statements as any[] | undefined;
    if (!stmts || stmts.length === 0) {
      return eslintDiag(ctx as KindCtx<KSNode>, 'no-empty-static-block',
        'Unexpected empty static block.');
    }
    return null;
  },
);
