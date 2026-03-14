/**
 * Phase 7 — Additional TS-specific synthesized equations.
 *
 * Rules targeting TypeScript-specific AST nodes: type assertions,
 * namespaces, non-null assertions, enum values, etc.
 */

import type { EslintEquivDiagnostic } from '../types.js';
import type { KindCtx, Ctx } from '@ksc/evaluation/domain/evaluator-index.js';
import type { KSNode, KSNodeBase, KSIdentifier } from '@ksc/language-ts-ast/grammar/index.js';
import { withDeps } from '@ksc/behavior';
import { eslintDiag } from './helpers.js';

// ── @typescript-eslint/no-non-null-assertion ─────────────────────────

export const eq_noNonNullAssertionViolation_NonNullExpression = withDeps([],
  function eq_noNonNullAssertionViolation_NonNullExpression(
    ctx: Ctx,
  ): EslintEquivDiagnostic | null {
    return eslintDiag(ctx as KindCtx<KSNode>, '@typescript-eslint/no-non-null-assertion',
      'Forbidden non-null assertion.');
  },
);

// ── @typescript-eslint/no-namespace ─────────────────────────────────

export const eq_noNamespaceViolation_ModuleDeclaration = withDeps([],
  function eq_noNamespaceViolation_ModuleDeclaration(
    ctx: Ctx,
  ): EslintEquivDiagnostic | null {
    // Allow `declare module 'foo'` (ambient module declarations with string literal name).
    // But flag `declare namespace Foo` — ESLint's default `allowDeclarations: false`.
    const ctxNode = ctx.node as KSNode;
    const modifiers = ctxNode.modifiers as KSNodeBase[] | undefined;
    const isDeclare = modifiers?.some((m) => m.kind === 'DeclareKeyword');
    const name = ctxNode.name as KSNodeBase | undefined;

    // `declare module 'foo'` is an ambient external module — always allowed
    if (isDeclare && name?.kind === 'StringLiteral') return null;

    return eslintDiag(ctx as KindCtx<KSNode>, '@typescript-eslint/no-namespace',
      "ES2015 module syntax is preferred over namespaces.");
  },
);

// ── @typescript-eslint/no-require-imports ────────────────────────────

export const eq_noRequireImportsViolation_CallExpression = withDeps([],
  function eq_noRequireImportsViolation_CallExpression(
    ctx: Ctx,
  ): EslintEquivDiagnostic | null {
    const ctxNode = ctx.node as KSNode;
    const expr = ctxNode.expression as KSNodeBase | undefined;
    if (!expr || expr.kind !== 'Identifier') return null;
    if ((expr as KSIdentifier).escapedText !== 'require') return null;
    return eslintDiag(ctx as KindCtx<KSNode>, '@typescript-eslint/no-require-imports',
      'A `require()` style import is forbidden.');
  },
);

// ── @typescript-eslint/no-empty-object-type ──────────────────────────

export const eq_noEmptyObjectTypeViolation_TypeLiteral = withDeps([],
  function eq_noEmptyObjectTypeViolation_TypeLiteral(
    ctx: Ctx,
  ): EslintEquivDiagnostic | null {
    const members = (ctx.node as KSNode).members as KSNodeBase[] | undefined;
    if (!members || members.length === 0) {
      return eslintDiag(ctx as KindCtx<KSNode>, '@typescript-eslint/no-empty-object-type',
        "The `{}` (\"empty object\") type allows any non-nullish value, including literals like `0` and `\"\"`.");
    }
    return null;
  },
);

// ── @typescript-eslint/consistent-type-assertions ────────────────────
// Default mode: prefer `as T` over `<T>x` (angle-bracket syntax)

export const eq_typeAssertionStyleViolation_TypeAssertionExpression = withDeps([],
  function eq_typeAssertionStyleViolation_TypeAssertionExpression(
    ctx: Ctx,
  ): EslintEquivDiagnostic | null {
    return eslintDiag(ctx as KindCtx<KSNode>, '@typescript-eslint/consistent-type-assertions',
      "Use 'as Type' instead of '<Type>'.");
  },
);

// ── @typescript-eslint/no-duplicate-enum-values ──────────────────────

export const eq_noDuplicateEnumValuesViolation_EnumDeclaration = withDeps([],
  function eq_noDuplicateEnumValuesViolation_EnumDeclaration(
    ctx: Ctx,
  ): EslintEquivDiagnostic[] {
    const violations: EslintEquivDiagnostic[] = [];
    const seen = new Map<string, boolean>(); // value → already seen

    for (const child of ctx.children) {
      if (child.node.kind !== 'EnumMember') continue;

      const init = (child.node as unknown as KSNodeBase).initializer as KSNodeBase | undefined;
      if (!init) continue; // auto-incremented → can't be duplicate

      let value: string | undefined;
      if (init.kind === 'StringLiteral') {
        value = `s:${init.value as string}`;
      } else if (init.kind === 'NumericLiteral') {
        value = `n:${init.value as string}`;
      }
      if (!value) continue; // non-literal → skip

      if (seen.has(value)) {
        violations.push(eslintDiag(
          child as unknown as KindCtx<KSNode>,
          '@typescript-eslint/no-duplicate-enum-values',
          'Duplicate enum member value.',
          init.pos, init.end,
        ));
      }
      seen.set(value, true);
    }

    return violations;
  },
);

// ── @typescript-eslint/prefer-as-const ───────────────────────────────
// Flags `x as 'literal'` when the expression already has that literal value.
// Also flags `<'literal'>x`.

export const eq_preferAsConstViolation_AsExpression = withDeps([],
  function eq_preferAsConstViolation_AsExpression(
    ctx: Ctx,
  ): EslintEquivDiagnostic | null {
    const ctxNode = ctx.node as KSNode;
    const typeNode = ctxNode.type as KSNodeBase | undefined;
    const expr = ctxNode.expression as KSNodeBase | undefined;
    if (!typeNode || !expr) return null;

    // Check if the type is a literal type matching the expression value
    if (typeNode.kind === 'LiteralType') {
      const literal = typeNode.literal as KSNodeBase | undefined;
      if (literal && expr.kind === literal.kind) {
        // Check value match for string/number literals
        if ((literal.kind === 'StringLiteral' || literal.kind === 'NumericLiteral')
            && literal.value === expr.value) {
          return eslintDiag(ctx as KindCtx<KSNode>, '@typescript-eslint/prefer-as-const',
            "Expected a `const` assertion instead of a literal type annotation.");
        }
      }
    }
    return null;
  },
);

export const eq_preferAsConstViolation_TypeAssertionExpression = withDeps([],
  function eq_preferAsConstViolation_TypeAssertionExpression(
    ctx: Ctx,
  ): EslintEquivDiagnostic | null {
    const ctxNode = ctx.node as KSNode;
    const typeNode = ctxNode.type as KSNodeBase | undefined;
    const expr = ctxNode.expression as KSNodeBase | undefined;
    if (!typeNode || !expr) return null;

    if (typeNode.kind === 'LiteralType') {
      const literal = typeNode.literal as KSNodeBase | undefined;
      if (literal && expr.kind === literal.kind) {
        if ((literal.kind === 'StringLiteral' || literal.kind === 'NumericLiteral')
            && literal.value === expr.value) {
          return eslintDiag(ctx as KindCtx<KSNode>, '@typescript-eslint/prefer-as-const',
            "Expected a `const` assertion instead of a literal type annotation.");
        }
      }
    }
    return null;
  },
);
