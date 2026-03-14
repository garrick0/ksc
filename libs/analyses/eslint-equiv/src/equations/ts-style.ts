/**
 * Group E — TS-specific synthesized equations for eslint-equiv rules.
 *
 * array-type: enforce T[] over Array<T>
 * consistent-type-definitions: enforce interface over type alias for object types
 */

import type { EslintEquivDiagnostic } from '../types.js';
import type { KindCtx } from '@ksc/evaluation/domain/evaluator-index.js';
import type { KSNode, KSNodeBase, KSIdentifier, KSTypeReference } from '@ksc/language-ts-ast/grammar/index.js';
import { withDeps } from '@ksc/behavior';
import { eslintDiag } from './helpers.js';

// ── @typescript-eslint/array-type ───────────────────────────────────

export const eq_arrayTypeViolation_TypeReference = withDeps([],
  function eq_arrayTypeViolation_TypeReference(
    ctx: KindCtx<KSNode>,
  ): EslintEquivDiagnostic | null {
    const typeName = ctx.node.typeName as KSNodeBase | undefined;
    if (!typeName || typeName.kind !== 'Identifier') return null;

    const name = (typeName as KSIdentifier).escapedText;
    if (name !== 'Array' && name !== 'ReadonlyArray') return null;

    const typeArgs = ctx.node.typeArguments as KSNodeBase[] | undefined;
    if (!typeArgs || typeArgs.length !== 1) return null;

    const suggestion = name === 'Array' ? 'T[]' : 'readonly T[]';
    return eslintDiag(ctx, '@typescript-eslint/array-type',
      `Array type using '${name}<T>' is forbidden. Use '${suggestion}' instead.`);
  },
);

// ── @typescript-eslint/consistent-type-definitions ──────────────────

export const eq_typeDeclStyleViolation_TypeAliasDeclaration = withDeps([],
  function eq_typeDeclStyleViolation_TypeAliasDeclaration(
    ctx: KindCtx<KSNode>,
  ): EslintEquivDiagnostic | null {
    const typeNode = ctx.node.type as KSNodeBase | undefined;
    if (!typeNode) return null;

    // Only flag when the RHS is a TypeLiteral (object type { ... })
    if (typeNode.kind === 'TypeLiteral') {
      return eslintDiag(ctx, '@typescript-eslint/consistent-type-definitions',
        'Use an `interface` instead of a `type`.');
    }

    return null;
  },
);
