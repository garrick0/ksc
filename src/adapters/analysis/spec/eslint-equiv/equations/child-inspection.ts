/**
 * Group B — Child-inspection synthesized equations for eslint-equiv rules.
 *
 * Each equation examines children of the flagged node to detect patterns
 * (duplicate keys, self-comparisons, parameter counts, etc.).
 */

import type { EslintEquivDiagnostic } from '../types.js';
import type { KindCtx, Ctx } from '@kindscript/core-evaluator';
import type {
  KSNode,
  KSBinaryExpression,
  KSFunctionDeclaration,
  KSArrowFunction,
} from '../../../../grammar/grammar/ts-ast/index.js';
import { withDeps } from '@kindscript/core-codegen';
import { eslintDiag } from './helpers.js';

// ── no-dupe-keys ────────────────────────────────────────────────────

export const eq_noDupeKeysViolation_ObjectLiteralExpression = withDeps([],
  function eq_noDupeKeysViolation_ObjectLiteralExpression(
    ctx: KindCtx<KSNode>,
  ): EslintEquivDiagnostic[] {
    const properties = (ctx.node as any).properties as any[] | undefined;
    if (!properties || properties.length === 0) return [];

    const seen = new Set<string>();
    const violations: EslintEquivDiagnostic[] = [];

    for (const prop of properties) {
      // Skip SpreadAssignment (no key name)
      if (prop.kind === 'SpreadAssignment') continue;

      const nameNode = prop.name;
      if (!nameNode) continue;

      // Skip computed properties — dynamic keys can't be statically checked
      if (nameNode.kind === 'ComputedPropertyName') continue;

      // Extract key text based on name node kind
      let key: string | undefined;
      if (nameNode.kind === 'Identifier') {
        key = nameNode.escapedText;
      } else if (nameNode.kind === 'StringLiteral' || nameNode.kind === 'NumericLiteral') {
        key = String(nameNode.value);
      }
      if (!key) continue;

      if (seen.has(key)) {
        violations.push(eslintDiag(
          ctx as KindCtx<KSNode>, 'no-dupe-keys',
          `Duplicate key '${key}'.`,
          prop.pos, prop.end,
        ));
      }
      seen.add(key);
    }

    return violations;
  },
);

// ── no-self-compare ─────────────────────────────────────────────────

const COMPARISON_OPS = new Set([
  'EqualsEqualsToken', 'EqualsEqualsEqualsToken',
  'ExclamationEqualsToken', 'ExclamationEqualsEqualsToken',
  'GreaterThanToken', 'LessThanToken',
  'GreaterThanEqualsToken', 'LessThanEqualsToken',
]);

/** Recursively compare two AGNode subtrees for structural equality. */
function nodesStructurallyEqual(a: Ctx, b: Ctx): boolean {
  if (a.node.kind !== b.node.kind) return false;
  if (a.children.length !== b.children.length) return false;

  // Leaf nodes — compare distinguishing properties
  if (a.children.length === 0) {
    if (a.node.kind === 'Identifier') {
      return (a.node as any).escapedText === (b.node as any).escapedText;
    }
    if ('value' in a.node && 'value' in b.node) {
      return (a.node as any).value === (b.node as any).value;
    }
    // Same kind, no distinguishing props (e.g., tokens/keywords)
    return true;
  }

  // Composite nodes — compare all children recursively
  return a.children.every((ac, i) => nodesStructurallyEqual(ac, b.children[i]));
}

export const eq_noSelfCompareViolation_BinaryExpression = withDeps([],
  function eq_noSelfCompareViolation_BinaryExpression(
    ctx: KindCtx<KSBinaryExpression>,
  ): EslintEquivDiagnostic | null {
    const opKind = ctx.node.operatorToken?.kind;
    if (!opKind || !COMPARISON_OPS.has(opKind)) return null;

    // Find left and right children by fieldName
    const leftChild = ctx.children.find(c => c.fieldName === 'left');
    const rightChild = ctx.children.find(c => c.fieldName === 'right');
    if (!leftChild || !rightChild) return null;

    if (nodesStructurallyEqual(leftChild, rightChild)) {
      return eslintDiag(ctx as KindCtx<KSNode>, 'no-self-compare',
        'Comparing to itself is potentially pointless.');
    }

    return null;
  },
);

// ── max-params ──────────────────────────────────────────────────────

// MAX_PARAMS is now an inh attribute 'maxParamsThreshold' (default: 3)

function checkMaxParams(ctx: Ctx): EslintEquivDiagnostic | null {
  const params = (ctx.node as any).parameters as any[] | undefined;
  const threshold = ctx.attr('maxParamsThreshold') as number;
  if (!params || params.length <= threshold) return null;
  return eslintDiag(ctx as KindCtx<KSNode>, 'max-params',
    `Function has too many parameters (${params.length}). Maximum allowed is ${threshold}.`);
}

export const eq_maxParamsViolation_FunctionDeclaration = withDeps(['maxParamsThreshold'],
  function eq_maxParamsViolation_FunctionDeclaration(
    ctx: KindCtx<KSFunctionDeclaration>,
  ): EslintEquivDiagnostic | null {
    return checkMaxParams(ctx);
  },
);

export const eq_maxParamsViolation_ArrowFunction = withDeps(['maxParamsThreshold'],
  function eq_maxParamsViolation_ArrowFunction(
    ctx: KindCtx<KSArrowFunction>,
  ): EslintEquivDiagnostic | null {
    return checkMaxParams(ctx);
  },
);

export const eq_maxParamsViolation_MethodDeclaration = withDeps(['maxParamsThreshold'],
  function eq_maxParamsViolation_MethodDeclaration(
    ctx: KindCtx<KSNode>,
  ): EslintEquivDiagnostic | null {
    return checkMaxParams(ctx);
  },
);

export const eq_maxParamsViolation_FunctionExpression = withDeps(['maxParamsThreshold'],
  function eq_maxParamsViolation_FunctionExpression(
    ctx: KindCtx<KSNode>,
  ): EslintEquivDiagnostic | null {
    return checkMaxParams(ctx);
  },
);

// ── @typescript-eslint/no-empty-interface ────────────────────────────

export const eq_noEmptyInterfaceViolation_InterfaceDeclaration = withDeps([],
  function eq_noEmptyInterfaceViolation_InterfaceDeclaration(
    ctx: KindCtx<KSNode>,
  ): EslintEquivDiagnostic | null {
    const members = (ctx.node as any).members as any[] | undefined;
    if (members && members.length > 0) return null;

    const heritageClauses = (ctx.node as any).heritageClauses as any[] | undefined;
    if (!heritageClauses || heritageClauses.length === 0) {
      return eslintDiag(ctx as KindCtx<KSNode>, '@typescript-eslint/no-empty-interface',
        'An empty interface is equivalent to `{}`.');
    }

    // Count extends types across all heritage clauses
    let extendsTypeCount = 0;
    for (const clause of heritageClauses) {
      if (clause.token === 'extends') {
        extendsTypeCount += clause.types?.length ?? 0;
      }
    }

    if (extendsTypeCount <= 1) {
      return eslintDiag(ctx as KindCtx<KSNode>, '@typescript-eslint/no-empty-interface',
        'An interface declaring no members is equivalent to its supertype.');
    }

    return null; // multiple extends → meaningful merge, OK
  },
);

// ── no-duplicate-imports ────────────────────────────────────────────

export const eq_noDuplicateImportsViolation_CompilationUnit = withDeps([],
  function eq_noDuplicateImportsViolation_CompilationUnit(
    ctx: Ctx,
  ): EslintEquivDiagnostic[] {
    const violations: EslintEquivDiagnostic[] = [];
    const seen = new Set<string>();

    for (const child of ctx.children) {
      if (child.node.kind !== 'ImportDeclaration') continue;

      const moduleSpec = (child.node as any).moduleSpecifier;
      if (!moduleSpec) continue;

      // StringLiteral's value field holds the unquoted module path
      const modText = moduleSpec.value as string | undefined;
      if (!modText) continue;

      if (seen.has(modText)) {
        violations.push({
          ruleId: 'no-duplicate-imports',
          node: child.node as KSNode,
          message: `'${modText}' import is duplicated.`,
          pos: child.node.pos,
          end: child.node.end,
          fileName: ctx.findFileName(),
        });
      }
      seen.add(modText);
    }

    return violations;
  },
);
