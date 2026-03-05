/**
 * The KindScript Checker — attribute grammar specification.
 *
 * Verifies annotated values satisfy their kind properties. Currently
 * checks `noImports`: a value's initializer must not reference imported bindings.
 *
 * 9 attributes, all declared as syn or inh with equations:
 *   valueImports, fileImports, localBindings, enclosingLocals,
 *   isReference, kindAnnotations, noImportsContext, importViolation, allViolations
 */

import type { KindDefinition, CheckerDiagnostic } from './types.js';
import type {
  KSNode, KSIdentifier, KSImportDeclaration, KSImportClause,
  KSNamedImports, KSImportSpecifier, KSNamespaceImport,
  KSVariableDeclaration, KSIntersectionType, KSTypeReferenceNode,
} from './ast.js';
import type { SpecInput } from '../../libs/ag/src/spec.js';

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
    const ref = typeNode as KSTypeReferenceNode;
    if (ref.typeName.kind === 'Identifier') {
      const def = defLookup((ref.typeName as KSIdentifier).escapedText);
      if (def) return [def];
    }
  }
  return [];
}

function collectFunctionLocals(funcNode: any): Set<string> {
  const locals = new Set<string>();

  for (const p of funcNode.parameters ?? []) {
    if (p.kind === 'Parameter' && p.name?.kind === 'Identifier') {
      locals.add((p.name as KSIdentifier).escapedText);
    }
  }

  if (!funcNode.body) return locals;
  const stack: KSNode[] = [funcNode.body];
  while (stack.length > 0) {
    const n = stack.pop()!;
    if (n.kind === 'VariableDeclaration') {
      const vd = n as KSVariableDeclaration;
      if (vd.name.kind === 'Identifier') {
        locals.add((vd.name as KSIdentifier).escapedText);
      }
    }
    if (n.kind === 'ArrowFunction' || n.kind === 'FunctionExpression' ||
        n.kind === 'FunctionDeclaration') continue;
    stack.push(...n.children);
  }

  return locals;
}

// ── Checker specification ──

/**
 * Create the checker spec — declarations + equations for kind property enforcement.
 *
 * Depends on: ksc-binder (for defLookup and kindDefs attributes).
 */
export function createCheckerSpec(): SpecInput<KSNode, CheckerDiagnostic[]> {
  return {
    name: 'ksc-checker',

    // Domain: WHAT each attribute is
    declarations: {
      valueImports:    { direction: 'syn' },
      fileImports:     { direction: 'inh', root: new Set<string>() },
      localBindings:   { direction: 'syn' },
      enclosingLocals: { direction: 'syn' },
      isReference:     { direction: 'syn' },
      kindAnnotations: { direction: 'syn' },
      noImportsContext:{ direction: 'inh', root: null as KindDefinition | null },
      importViolation: { direction: 'syn' },
      allViolations:   {
        direction: 'collection' as const,
        initial: [] as CheckerDiagnostic[],
        combine: (acc: CheckerDiagnostic[], contrib: CheckerDiagnostic[]) =>
          acc.length === 0 ? contrib : contrib.length === 0 ? acc : [...acc, ...contrib],
      },
    },

    // Rules: HOW each attribute is computed
    equations: {
      // 4.1 valueImports — production equations
      valueImports: {
        CompilationUnit: (cu: KSNode) => {
          const names = new Set<string>();
          for (const child of cu.children) {
            if (child.kind !== 'ImportDeclaration') continue;
            const imp = child as KSImportDeclaration;
            const clause = imp.importClause;
            if (!clause || clause.kind !== 'ImportClause') continue;
            const ic = clause as KSImportClause;
            if (ic.isTypeOnly) continue;

            // Default import
            if (ic.name) names.add(ic.name.escapedText);

            // Named imports
            if (ic.namedBindings?.kind === 'NamedImports') {
              for (const el of (ic.namedBindings as KSNamedImports).elements) {
                if (el.kind !== 'ImportSpecifier') continue;
                const spec = el as KSImportSpecifier;
                if (spec.isTypeOnly) continue;
                names.add(spec.name.escapedText);
              }
            }

            // Namespace import
            if (ic.namedBindings?.kind === 'NamespaceImport') {
              names.add((ic.namedBindings as KSNamespaceImport).name.escapedText);
            }
          }
          return names;
        },
        _: () => new Set<string>(),
      },

      // 4.2 fileImports — inh equation
      fileImports: (parent: KSNode) => {
        if (parent.kind === 'CompilationUnit') {
          return (parent as any).valueImports as Set<string>;
        }
        return undefined; // auto-propagate
      },

      // 4.3 localBindings — production equations
      localBindings: {
        ArrowFunction: collectFunctionLocals,
        FunctionExpression: collectFunctionLocals,
        FunctionDeclaration: collectFunctionLocals,
        _: () => new Set<string>(),
      },

      // 4.4 enclosingLocals — direct equation
      enclosingLocals: (node: KSNode) => {
        const locals = new Set<string>();
        let current: any = (node as any).$parent;
        while (current) {
          if (current.kind === 'ArrowFunction' ||
              current.kind === 'FunctionExpression' ||
              current.kind === 'FunctionDeclaration') {
            const bindings: Set<string> = current.localBindings;
            for (const name of bindings) locals.add(name);
          }
          current = current.$parent;
        }
        return locals;
      },

      // 4.5 isReference — production equations
      isReference: {
        Identifier: (node: KSNode) => {
          const parent: any = (node as any).$parent;
          if (!parent) return true;
          if (parent.kind === 'PropertyAccessExpression' && parent.name === node) return false;
          if (parent.kind === 'VariableDeclaration' && parent.name === node) return false;
          if (parent.kind === 'Parameter' && parent.name === node) return false;
          if (parent.kind === 'FunctionDeclaration' && parent.name === node) return false;
          if (parent.kind === 'FunctionExpression' && parent.name === node) return false;
          if (parent.kind === 'PropertyAssignment' && parent.name === node) return false;
          if (parent.kind === 'ImportSpecifier') return false;
          if (parent.kind === 'TypeAliasDeclaration' && parent.name === node) return false;
          return true;
        },
        _: () => false,
      },

      // 4.6 kindAnnotations — production equations
      kindAnnotations: {
        VariableDeclaration: (node: KSNode) => {
          const varDecl = node as KSVariableDeclaration;
          if (!varDecl.type) return [];
          const defLookup = (node as any).defLookup as (name: string) => KindDefinition | undefined;
          if (!defLookup) return [];
          return extractKindAnnotations(varDecl.type, defLookup);
        },
        _: () => [],
      },

      // 4.7 noImportsContext — inh equation
      noImportsContext: (parent: KSNode) => {
        if (parent.kind === 'VariableDeclaration') {
          const kinds: KindDefinition[] = (parent as any).kindAnnotations;
          const noImportsKind = kinds.find((k: KindDefinition) => k.properties.noImports);
          if (noImportsKind) return noImportsKind;
        }
        return undefined; // auto-propagate
      },

      // 4.8 importViolation — production equations
      importViolation: {
        Identifier: (node: KSNode) => {
          const ctx: KindDefinition | null = (node as any).noImportsContext;
          if (!ctx) return null;
          if (!(node as any).isReference) return null;
          const name = (node as KSIdentifier).escapedText;
          const imports: Set<string> = (node as any).fileImports;
          if (!imports.has(name)) return null;
          const locals: Set<string> = (node as any).enclosingLocals;
          if (locals.has(name)) return null;

          let cu: any = (node as any).$parent;
          while (cu && cu.kind !== 'CompilationUnit') cu = cu.$parent;

          return {
            node,
            message: `'${name}' is an imported binding, violating ${ctx.name} (noImports)`,
            kindName: ctx.name,
            property: 'noImports',
            pos: node.pos,
            end: node.end,
            fileName: cu?.fileName ?? '<unknown>',
          };
        },
        _: () => null,
      },

      // 4.9 allViolations — collection equation (contribution per node)
      allViolations: (node: KSNode) => {
        const v: CheckerDiagnostic | null = (node as any).importViolation;
        return v ? [v] : [];
      },
    },

    deps: ['ksc-binder'],
    project: (root) => (root as any).allViolations,
  };
}
