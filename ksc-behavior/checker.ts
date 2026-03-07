/**
 * The KindScript Checker — equation functions for kind property enforcement.
 *
 * Verifies annotated values satisfy their kind properties. Currently
 * checks `noImports`: a value's initializer must not reference imported bindings.
 *
 * Import resolution is handled by TS's checker at AST conversion time
 * (stamped as `resolvesToImport` on each KSIdentifier). This eliminates
 * the need for custom scoping attributes.
 *
 * 4 attributes:
 *   kindAnnotations, noImportsContext, importViolation, allViolations
 */

import type { KindDefinition, CheckerDiagnostic } from './types.js';
import type {
  KSNode, KSIdentifier,
  KSVariableDeclaration, KSIntersectionType, KSTypeReference,
} from '../ast-schema/generated/index.js';
import type { Ctx } from './ctx.js';

// ── Helpers (pure functions called inside equations) ──

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

// ── Standalone equation functions ──

export function eq_kindAnnotations_VariableDeclaration(ctx: Ctx, raw: KSNode): KindDefinition[] {
  const varDecl = raw as KSVariableDeclaration;
  if (!varDecl.type) return [];
  const defLookup = ctx.attr('defLookup');
  return extractKindAnnotations(varDecl.type, defLookup);
}

export function eq_kindAnnotations_default(): KindDefinition[] {
  return [];
}

export function eq_noImportsContext(parentCtx: Ctx): KindDefinition | null | undefined {
  if ((parentCtx.node as any).kind === 'VariableDeclaration') {
    const kinds = parentCtx.attr('kindAnnotations');
    const noImportsKind = kinds.find((k: KindDefinition) => k.properties.noImports);
    if (noImportsKind) return noImportsKind;
  }
  return undefined;
}

export const eq_noImportsContext_rootValue: KindDefinition | null = null;

export function eq_importViolation_Identifier(ctx: Ctx, raw: KSNode): CheckerDiagnostic | null {
  const noImportsCtx = ctx.attr('noImportsContext');
  if (!noImportsCtx) return null;
  const ident = raw as KSIdentifier;
  if (!ident.resolvesToImport) return null;

  let current = ctx.parent;
  while (current && (current.node as any).kind !== 'CompilationUnit') {
    current = current.parent;
  }

  return {
    node: raw,
    message: `'${ident.escapedText}' is an imported binding, violating ${noImportsCtx.name} (noImports)`,
    kindName: noImportsCtx.name,
    property: 'noImports',
    pos: raw.pos,
    end: raw.end,
    fileName: current ? (current.node as any).fileName : '<unknown>',
  };
}

export function eq_importViolation_default(): CheckerDiagnostic | null {
  return null;
}

export function eq_allViolations_contribute(ctx: Ctx): CheckerDiagnostic[] {
  const v = ctx.attr('importViolation');
  return v ? [v] : [];
}

export function eq_allViolations_combine(acc: CheckerDiagnostic[], contrib: CheckerDiagnostic[]): CheckerDiagnostic[] {
  return acc.length === 0 ? contrib : contrib.length === 0 ? acc : [...acc, ...contrib];
}

export function project_checker(root: Ctx): CheckerDiagnostic[] {
  return root.attr('allViolations');
}
