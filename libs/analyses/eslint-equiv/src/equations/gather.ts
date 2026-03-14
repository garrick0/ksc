/**
 * Gather equation — collects all eslint-equiv violations from this node
 * and all descendants into a flat array.
 *
 * Similar to the allViolations pattern in ts-kind-checking.
 */

import type { EslintEquivDiagnostic } from '../types.js';
import type { Ctx } from '@ksc/evaluation/domain/evaluator-index.js';
import { withDeps } from '@ksc/behavior';

/**
 * Attribute names that produce EslintEquivDiagnostic | null (single).
 *
 * IMPORTANT: When adding a new single-valued rule attribute to the spec,
 * you MUST add it here as well. If missing, the rule's violations will be
 * silently omitted from the gathered results. See also ARRAY_RULE_ATTRS below.
 */
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
  // Scope
  'noShadowViolation',
  // Complexity
  'complexityViolation',
] as const;

/**
 * Attribute names that produce EslintEquivDiagnostic[] (array).
 *
 * IMPORTANT: When adding a new array-valued rule attribute to the spec,
 * you MUST add it here. See SINGLE_RULE_ATTRS above for single-valued rules.
 */
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
  // Control flow
  'noUnreachableViolation',
  'noFallthroughViolation',
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

export const eq_violations_Program = withDeps(
  ['allEslintViolations'],
  function eq_violations_Program(ctx: Ctx): Record<string, EslintEquivDiagnostic[]> {
    const grouped: Record<string, EslintEquivDiagnostic[]> = {};
    for (const diagnostic of ctx.attr('allEslintViolations') as EslintEquivDiagnostic[]) {
      if (!grouped[diagnostic.ruleId]) grouped[diagnostic.ruleId] = [];
      grouped[diagnostic.ruleId].push(diagnostic);
    }
    return grouped;
  },
);

export const eq_violations_default = withDeps(
  [],
  function eq_violations_default(_ctx: Ctx): Record<string, EslintEquivDiagnostic[]> {
    return {};
  },
);
