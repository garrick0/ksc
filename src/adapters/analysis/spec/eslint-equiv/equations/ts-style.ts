/**
 * Group E — TS-specific synthesized equations for eslint-equiv rules.
 *
 * array-type: enforce T[] over Array<T>
 * consistent-type-definitions: enforce interface over type alias for object types
 */

import type { EslintEquivDiagnostic } from '../types.js';
import type { KindCtx } from '@kindscript/core-evaluator';
import type { KSNode } from '../../../../grammar/grammar/ts-ast/index.js';
import { withDeps } from '@kindscript/core-codegen';
import { eslintDiag } from './helpers.js';

// ── @typescript-eslint/array-type ───────────────────────────────────

export const eq_arrayTypeViolation_TypeReference = withDeps([],
  function eq_arrayTypeViolation_TypeReference(
    ctx: KindCtx<KSNode>,
  ): EslintEquivDiagnostic | null {
    const typeName = (ctx.node as any).typeName;
    if (!typeName || typeName.kind !== 'Identifier') return null;

    const name = typeName.escapedText as string;
    if (name !== 'Array' && name !== 'ReadonlyArray') return null;

    const typeArgs = (ctx.node as any).typeArguments as any[] | undefined;
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
    const typeNode = (ctx.node as any).type;
    if (!typeNode) return null;

    // Only flag when the RHS is a TypeLiteral (object type { ... })
    if (typeNode.kind === 'TypeLiteral') {
      return eslintDiag(ctx, '@typescript-eslint/consistent-type-definitions',
        'Use an `interface` instead of a `type`.');
    }

    return null;
  },
);
