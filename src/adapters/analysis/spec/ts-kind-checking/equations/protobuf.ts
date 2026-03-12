/**
 * Protobuf getter enforcement equations.
 *
 * Detects direct field access on google-protobuf / grpc-web message objects,
 * where `msg.field` silently returns `undefined` because protobuf stores data
 * in internal arrays. The correct access pattern is `msg.getField()`.
 *
 * Attributes:
 *   protobufTypes          — syn: protobuf type names from imports (CompilationUnit)
 *   protobufTypeEnv        — inh: set of all protobuf type names (broadcast)
 *   protobufViolation      — syn: violation diagnostic (PropertyAccessExpression)
 *   allProtobufViolations  — syn: recursive gather of protobuf violations
 *
 * Follows the canonical AG collect-propagate-check pattern:
 *   protobufTypes (collect) → protobufTypeEnv (propagate) → protobufViolation (check)
 */

import type { Diagnostic } from '../types.js';
import type {
  KSCompilationUnit,
  KSImportDeclaration,
  KSStringLiteral,
  KSIdentifier,
  KSPropertyAccessExpression,
  KSNode,
} from '../../../../grammar/grammar/ts-ast/index.js';
import type { Ctx, KindCtx } from '@kindscript/core-evaluator';
import { withDeps } from '@kindscript/core-codegen';

// ── Global toggle ────────────────────────────────────────────────────

export let PROTOBUF_CHECKING_ENABLED = false;

/** Set the protobuf checking toggle (needed because ES module exports are read-only). */
export function setProtobufCheckingEnabled(enabled: boolean): void {
  PROTOBUF_CHECKING_ENABLED = enabled;
}

// ── Module pattern matching ──────────────────────────────────────────

const PROTOBUF_MODULE_PATTERNS: RegExp[] = [
  /^.*_pb$/,            // matches './person_pb', '@corp/user_pb'
  /^.*_grpc_web_pb$/,   // matches './service_grpc_web_pb'
];

export function isProtobufModule(moduleSpecifier: string): boolean {
  return PROTOBUF_MODULE_PATTERNS.some(re => re.test(moduleSpecifier));
}

// ── ProtobufBinding type ─────────────────────────────────────────────

export interface ProtobufBinding {
  name: string;
  namespace: boolean;
}

// ── typeString matching ──────────────────────────────────────────────

function isProtobufType(typeString: string, env: Set<string>): boolean {
  if (env.has(typeString)) return true;
  for (const typeName of env) {
    if (typeString.startsWith(typeName + '<') ||
        typeString.startsWith(typeName + ' ')) {
      return true;
    }
  }
  return false;
}

// ── protobufTypes equation (synthesized, on CompilationUnit) ─────────

export const eq_protobufTypes_CompilationUnit = withDeps([],
  function eq_protobufTypes_CompilationUnit(ctx: KindCtx<KSCompilationUnit>): Map<string, ProtobufBinding> {
    if (!PROTOBUF_CHECKING_ENABLED) return new Map();

    const bindings = new Map<string, ProtobufBinding>();
    for (const childCtx of ctx.children) {
      if (childCtx.node.kind !== 'ImportDeclaration') continue;
      const importDecl = childCtx.node as KSImportDeclaration;

      // Check module specifier against patterns
      if (importDecl.moduleSpecifier.kind !== 'StringLiteral') continue;
      const modulePath = (importDecl.moduleSpecifier as KSStringLiteral).value;
      if (!isProtobufModule(modulePath)) continue;

      // Get the import clause (optional — bare imports like `import './pb'` have none)
      if (!importDecl.importClause) continue;

      // Skip type-only imports (ImportClause.isTypeOnly)
      const clause = importDecl.importClause as unknown as { isTypeOnly?: boolean; name?: KSNode };
      if (clause.isTypeOnly) continue;

      // Walk children of the ImportClause to find bindings
      // ImportClause can have:
      //   - name (default import: Identifier)
      //   - namedBindings (NamedImports with elements, or NamespaceImport with name)
      for (const clauseChild of childCtx.children) {
        // The ImportClause is a child of ImportDeclaration
        if (clauseChild.node.kind === 'ImportClause') {
          // Default import: ImportClause.name
          if (clause.name && clause.name.kind === 'Identifier') {
            const id = clause.name as KSIdentifier;
            bindings.set(id.escapedText, { name: id.escapedText, namespace: false });
          }

          // Walk ImportClause's children for NamedImports / NamespaceImport
          for (const bindingChild of clauseChild.children) {
            if (bindingChild.node.kind === 'NamespaceImport') {
              // import * as proto from './pb'
              const nsName = (bindingChild.node as unknown as { name?: KSNode }).name;
              if (nsName && nsName.kind === 'Identifier') {
                const id = nsName as KSIdentifier;
                bindings.set(id.escapedText, { name: id.escapedText, namespace: true });
              }
            } else if (bindingChild.node.kind === 'NamedImports') {
              // import { Person, Address } from './pb'
              for (const specChild of bindingChild.children) {
                if (specChild.node.kind === 'ImportSpecifier') {
                  // The local name is ImportSpecifier.name
                  const specName = (specChild.node as unknown as { name?: KSNode }).name;
                  if (specName && specName.kind === 'Identifier') {
                    const id = specName as KSIdentifier;
                    bindings.set(id.escapedText, { name: id.escapedText, namespace: false });
                  }
                }
              }
            }
          }
        }
      }
    }
    return bindings;
  }
);

export const eq_protobufTypes_default = withDeps([],
  function eq_protobufTypes_default(_ctx: Ctx): Map<string, ProtobufBinding> {
    return new Map();
  }
);

// ── protobufTypeEnv equation (inherited, root value) ─────────────────

export const eq_protobufTypeEnv_root = withDeps(['protobufTypes'],
  function eq_protobufTypeEnv_root(ctx: Ctx): Set<string> {
    if (!PROTOBUF_CHECKING_ENABLED) return new Set();

    const typeNames = new Set<string>();
    for (const cuCtx of ctx.children) {
      const bindings = cuCtx.attr('protobufTypes') as Map<string, ProtobufBinding>;
      for (const [name] of bindings) {
        typeNames.add(name);
      }
    }
    return typeNames;
  }
);

// ── protobufViolation equation (synthesized, on PropertyAccessExpression) ──

export const eq_protobufViolation_PropertyAccessExpression = withDeps(['protobufTypeEnv'],
  function eq_protobufViolation_PropertyAccessExpression(ctx: KindCtx<KSPropertyAccessExpression>): Diagnostic | null {
    // Step 1: Is the object expression a protobuf type?
    const env = ctx.attr('protobufTypeEnv') as Set<string>;
    if (env.size === 0) return null;

    const exprNode = ctx.node.expression;
    const exprType = (exprNode as Record<string, unknown>).typeString as string | undefined;
    if (!exprType || !isProtobufType(exprType, env)) return null;

    // Step 2: Is the accessed name a method?
    if (ctx.node.name.kind === 'Identifier') {
      const nameId = ctx.node.name as KSIdentifier;
      if (nameId.symIsMethod) return null;
    }

    // Step 3: Is this being called? (handles loose types where symIsMethod isn't set)
    if (ctx.parentIs('CallExpression', 'expression')) return null;

    // Violation
    const fieldName = ctx.node.name.kind === 'Identifier'
      ? (ctx.node.name as KSIdentifier).escapedText
      : '?';
    return {
      node: ctx.node,
      message: `Direct field access '.${fieldName}' on protobuf type '${exprType}' — use getter method instead`,
      kindName: '',
      property: 'protobuf-getter',
      pos: ctx.node.pos,
      end: ctx.node.end,
      fileName: ctx.findFileName(),
    };
  }
);

// ── protobufViolation equation (synthesized, on ElementAccessExpression) ──

export const eq_protobufViolation_ElementAccessExpression = withDeps(['protobufTypeEnv'],
  function eq_protobufViolation_ElementAccessExpression(ctx: Ctx): Diagnostic | null {
    const env = ctx.attr('protobufTypeEnv') as Set<string>;
    if (env.size === 0) return null;

    const node = ctx.node as KSNode;
    // expression is the object being accessed (e.g., msg in msg['name'])
    const exprNode = (node as unknown as { expression: KSNode }).expression;
    const exprType = (exprNode as Record<string, unknown>).typeString as string | undefined;
    if (!exprType || !isProtobufType(exprType, env)) return null;

    // Is this being called? (e.g., msg['getName']() — unlikely but handle it)
    if (ctx.parentIs('CallExpression', 'expression')) return null;

    // argumentExpression is the key (e.g., 'name' in msg['name'])
    const argExpr = (node as unknown as { argumentExpression: KSNode }).argumentExpression;
    const keyName = argExpr?.kind === 'StringLiteral'
      ? (argExpr as KSStringLiteral).value
      : '?';

    return {
      node,
      message: `Direct element access ['${keyName}'] on protobuf type '${exprType}' — use getter method instead`,
      kindName: '',
      property: 'protobuf-getter',
      pos: node.pos,
      end: node.end,
      fileName: ctx.findFileName(),
    };
  }
);

export const eq_protobufViolation_default = withDeps([],
  function eq_protobufViolation_default(_ctx: Ctx): Diagnostic | null {
    return null;
  }
);

// ── allProtobufViolations equation (synthesized, recursive gather) ────

export const eq_allProtobufViolations = withDeps(['protobufViolation'],
  function eq_allProtobufViolations(ctx: Ctx): Diagnostic[] {
    if (!PROTOBUF_CHECKING_ENABLED) return [];

    const result: Diagnostic[] = [];
    const v = ctx.attr('protobufViolation') as Diagnostic | null;
    if (v) result.push(v);
    for (const child of ctx.children) {
      const childViolations = child.attr('allProtobufViolations') as Diagnostic[];
      if (childViolations.length > 0) {
        result.push(...childViolations);
      }
    }
    return result;
  }
);
