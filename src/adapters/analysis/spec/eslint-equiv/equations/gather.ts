/**
 * Gather equation — collects all eslint-equiv violations from this node
 * and all descendants into a flat array.
 *
 * Similar to the allViolations pattern in ts-kind-checking.
 */

import type { EslintEquivDiagnostic } from '../types.js';
import type { Ctx } from '@kindscript/core-evaluator';
import { withDeps } from '@kindscript/core-codegen';

/** Attribute names that produce EslintEquivDiagnostic | null (single). */
const SINGLE_RULE_ATTRS = [
  // Group A
  'eqeqeqViolation',
  'noVarViolation',
  'noDebuggerViolation',
  'noEmptyViolation',
  'noBitwiseViolation',
  'noExplicitAnyViolation',
  // Group B (single)
  'noSelfCompareViolation',
  'maxParamsViolation',
  'noEmptyInterfaceViolation',
  // Group C
  'maxDepthViolation',
  // Group E
  'arrayTypeViolation',
  'typeDeclStyleViolation',
  // Phase 6
  'noConsoleViolation',
  'noEvalViolation',
  'noNewWrappersViolation',
  'noPlusPlusViolation',
  'noTemplateCurlyViolation',
  'noCondAssignViolation',
  'noSelfAssignViolation',
  'defaultCaseViolation',
  'defaultCaseLastViolation',
  'noUselessCatchViolation',
  'noMultiAssignViolation',
  'yodaViolation',
  'noEmptyFunctionViolation',
  'useIsNanViolation',
  'noSparseArraysViolation',
  'noEmptyPatternViolation',
  // Phase 7
  'noNonNullAssertionViolation',
  'noNamespaceViolation',
  'noRequireImportsViolation',
  'noEmptyObjectTypeViolation',
  'typeAssertionStyleViolation',
  'preferAsConstViolation',
  // Phase 8
  'noUselessConstructorViolation',
  'noEmptyStaticBlockViolation',
] as const;

/** Attribute names that produce EslintEquivDiagnostic[] (array). */
const ARRAY_RULE_ATTRS = [
  // Group B (array)
  'noDupeKeysViolation',
  'noDuplicateImportsViolation',
  // Phase 6 (array)
  'noDuplicateCaseViolation',
  // Phase 7 (array)
  'noDuplicateEnumValuesViolation',
  // Phase 8
  'noDupeClassMembersViolation',
] as const;

/** All rule attribute names (for dep declaration). */
const ALL_RULE_ATTRS: string[] = [
  ...SINGLE_RULE_ATTRS,
  ...ARRAY_RULE_ATTRS,
];

export const eq_allEslintViolations = withDeps(
  ALL_RULE_ATTRS,
  function eq_allEslintViolations(ctx: Ctx): EslintEquivDiagnostic[] {
    const result: EslintEquivDiagnostic[] = [];

    // Gather single-valued per-rule attributes
    for (const attrName of SINGLE_RULE_ATTRS) {
      const v = ctx.attr(attrName) as EslintEquivDiagnostic | null;
      if (v) result.push(v);
    }

    // Gather array-valued per-rule attributes
    for (const attrName of ARRAY_RULE_ATTRS) {
      const v = ctx.attr(attrName) as EslintEquivDiagnostic[];
      if (v.length > 0) result.push(...v);
    }

    // Recurse into children
    for (const child of ctx.children) {
      const childViolations = child.attr('allEslintViolations') as EslintEquivDiagnostic[];
      if (childViolations.length > 0) result.push(...childViolations);
    }

    return result;
  },
);
