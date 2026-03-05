/**
 * The KindScript Binder — attribute grammar specification.
 *
 * Defines the binder as a SpecInput: declarations (what each attribute is)
 * and equations (how each attribute is computed), evaluated over the KSC AST.
 *
 * Attributes:
 *   kindDefs    — KindDefinition[] (syn, on CompilationUnit nodes)
 *   defEnv      — Map<string, KindDefinition> (inh, propagated from root)
 *   defLookup   — (name: string) => KindDefinition | undefined (syn, from defEnv)
 */

import type { PropertySet } from '../api/kinds.js';
import type { KindDefinition } from './types.js';
import type {
  KSNode, KSTypeAliasDeclaration, KSTypeReferenceNode,
  KSTypeLiteralNode, KSIdentifier, KSPropertySignature,
} from './ast.js';
import type { SpecInput } from '../../libs/ag/src/spec.js';

// ── Property extraction ──

const PROPERTY_KEYS = new Set(['noImports']);

function extractPropertiesFromTypeLiteral(node: KSTypeLiteralNode): PropertySet {
  const props: Record<string, unknown> = {};

  for (const member of node.members) {
    if (member.kind !== 'PropertySignature') continue;
    const sig = member as KSPropertySignature;
    if (sig.name.kind !== 'Identifier') continue;
    const name = (sig.name as KSIdentifier).escapedText;
    if (!PROPERTY_KEYS.has(name)) continue;

    if (!sig.type) continue;

    if (sig.type.kind === 'TrueKeyword') {
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

function tryExtractKindDef(
  node: KSTypeAliasDeclaration,
  nextId: () => string,
): KindDefinition | undefined {
  if (node.type.kind !== 'TypeReference') return undefined;
  const typeRef = node.type as KSTypeReferenceNode;

  if (typeRef.typeName.kind !== 'Identifier') return undefined;
  if ((typeRef.typeName as KSIdentifier).escapedText !== 'Kind') return undefined;

  if (typeRef.typeArguments.length !== 1) return undefined;
  const arg = typeRef.typeArguments[0];
  if (arg.kind !== 'TypeLiteral') return undefined;

  const properties = extractPropertiesFromTypeLiteral(arg as KSTypeLiteralNode);

  return {
    id: nextId(),
    name: node.name.escapedText,
    properties,
    node,
  };
}

// ── Binder specification ──

/**
 * Create the binder spec — declarations + equations for kind definition discovery.
 */
export function createBinderSpec(): SpecInput<KSNode, KindDefinition[]> {
  let nextDefId = 0;

  return {
    name: 'ksc-binder',

    // Domain: WHAT each attribute is
    declarations: {
      kindDefs:  { direction: 'syn' },
      defEnv:    { direction: 'inh', root: (root: KSNode) => {
        const map = new Map<string, KindDefinition>();
        for (const cu of (root as any).$children ?? []) {
          for (const def of ((cu as any).kindDefs ?? []) as KindDefinition[]) {
            map.set(def.name, def);
          }
        }
        return map;
      }},
      defLookup: { direction: 'syn' },
    },

    // Rules: HOW each attribute is computed
    equations: {
      kindDefs: {
        CompilationUnit: (cu: KSNode) => {
          const defs: KindDefinition[] = [];
          for (const stmt of cu.children) {
            if (stmt.kind !== 'TypeAliasDeclaration') continue;
            const def = tryExtractKindDef(
              stmt as KSTypeAliasDeclaration,
              () => `kdef-${nextDefId++}`,
            );
            if (def) defs.push(def);
          }
          return defs;
        },
        _: () => [],
      },
      defEnv: undefined,
      defLookup: (node: KSNode) => {
        const env: Map<string, KindDefinition> = (node as any).defEnv;
        return (name: string) => env.get(name);
      },
    },

    project: (root) => {
      const allDefs: KindDefinition[] = [];
      for (const cu of (root as any).compilationUnits ?? (root as any).$children ?? []) {
        allDefs.push(...((cu as any).kindDefs ?? []));
      }
      return allDefs;
    },
  };
}
