/**
 * Kind definition extraction for the kind-checking analysis.
 *
 * Provides:
 *   extractPropertiesFromTypeLiteral  — extract PropertySet from a type literal
 *   tryExtractKindDef                 — attempt to extract a KindDefinition from a type alias
 */

import type { PropertySet } from '../types.js';
import { PROPERTY_KEYS } from '../types.js';
import type { KindDefinition } from '../types.js';
import type {
  KSNode, KSTypeAliasDeclaration, KSTypeReference,
  KSTypeLiteral, KSLiteralType, KSIdentifier, KSPropertySignature,
} from '@ksc/language-ts-ast/grammar/index.js';

// ── Definition extraction helpers ───────────────────────────────────

export function extractPropertiesFromTypeLiteral(node: KSTypeLiteral): PropertySet {
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
      const litType = sig.type as KSLiteralType;
      if (litType.literal.kind === 'TrueKeyword') {
        props[name] = true;
      }
    }
  }

  return props as PropertySet;
}

export function tryExtractKindDef(
  node: KSTypeAliasDeclaration,
  fileName: string,
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
    // Stable identity per source location avoids hidden run-local counters.
    id: `kdef:${fileName}:${node.pos}:${node.end}`,
    name: node.name.escapedText,
    properties: properties as Record<string, boolean | undefined>,
    node,
  };
}
