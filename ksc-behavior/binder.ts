/**
 * The KindScript Binder — equation functions for kind definition discovery.
 *
 * Attributes:
 *   kindDefs    — KindDefinition[] (syn, on CompilationUnit nodes)
 *   defEnv      — Map<string, KindDefinition> (inh, propagated from root)
 *   defLookup   — (name: string) => KindDefinition | undefined (syn, from defEnv)
 */

import type { PropertySet, KindDefinition } from './types.js';
import type {
  KSNode, KSTypeAliasDeclaration, KSTypeReference,
  KSTypeLiteral, KSIdentifier, KSPropertySignature,
} from '../ast-schema/generated/index.js';
import type { Ctx } from './ctx.js';

// ── Property extraction ──

const PROPERTY_KEYS = new Set(['noImports']);

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

// ── Definition extraction ──

/** Mutable counter for generating unique definition IDs. */
export interface DefIdCounter { value: number }

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
    properties,
    node,
  };
}

// ── Standalone equation functions ──

/** @extraArg this._counter */
export function eq_kindDefs_CompilationUnit(ctx: Ctx, counter: DefIdCounter): KindDefinition[] {
  const defs: KindDefinition[] = [];
  for (const childCtx of ctx.children) {
    if ((childCtx.node as any).kind !== 'TypeAliasDeclaration') continue;
    const def = tryExtractKindDef(childCtx.node as KSTypeAliasDeclaration, counter);
    if (def) defs.push(def);
  }
  return defs;
}

export function eq_kindDefs_default(): KindDefinition[] {
  return [];
}

export function eq_defEnv_root(rootCtx: Ctx): Map<string, KindDefinition> {
  const map = new Map<string, KindDefinition>();
  for (const cuCtx of rootCtx.children) {
    for (const def of cuCtx.attr('kindDefs')) {
      map.set(def.name, def);
    }
  }
  return map;
}

export function eq_defLookup(ctx: Ctx): (name: string) => KindDefinition | undefined {
  const env = ctx.attr('defEnv');
  return (name: string) => env.get(name);
}

export function project_binder(root: Ctx): KindDefinition[] {
  const allDefs: KindDefinition[] = [];
  for (const cuCtx of root.children) {
    allDefs.push(...cuCtx.attr('kindDefs'));
  }
  return allDefs;
}
