/**
 * TS → KS AST conversion layer (hand-written, schema-driven).
 *
 * Walks the TypeScript AST and produces a KS mirror tree.
 * Uses NODES schema at runtime for generic field extraction,
 * with per-kind custom extractors for TS-specific transformations.
 *
 * Stateless: all mutable state lives in a ConvertContext created per buildKSTree call.
 */

import ts from 'typescript';
import type { KSNode, KSCommentRange, KSProgram, KSCompilationUnit, KSStatement } from '../../grammar/ts-ast/index.js';
import type { FieldDescShape, AstTranslatorPort } from '@kindscript/core-grammar';
import { NODES, fieldDefs } from '../../grammar/ts-ast/index.js';
import {
  isNodeExported, getLocalCount,
  getTypeString,
  extractJSDocComment,
  type AnalysisDepth,
  type ConvertContext as BaseConvertContext,
} from './helpers.js';
import { CUSTOM_EXTRACTORS } from './custom-extractors.js';

export type { AnalysisDepth } from './helpers.js';

export interface KSTree {
  root: KSProgram;
}

/** Per-invocation context — holds all mutable state for a single buildKSTree call. */
type ConvertContext = BaseConvertContext & {
  tsToKs: WeakMap<ts.Node, KSNode>;
};

// ═══════════════════════════════════════════════════════════════════════
// Infrastructure
// ═══════════════════════════════════════════════════════════════════════

function toCommentRange(cr: ts.CommentRange): KSCommentRange {
  return {
    pos: cr.pos,
    end: cr.end,
    kind: cr.kind === ts.SyntaxKind.SingleLineCommentTrivia ? 'SingleLine' : 'MultiLine',
    hasTrailingNewLine: cr.hasTrailingNewLine,
  };
}

function attachComments(ksNode: KSNode, tsNode: ts.Node, sf: ts.SourceFile): void {
  const sourceText = sf.getFullText();
  const leading = ts.getLeadingCommentRanges(sourceText, tsNode.getFullStart());
  const trailing = ts.getTrailingCommentRanges(sourceText, tsNode.getEnd());
  if (leading && leading.length > 0) {
    ksNode.leadingComments = leading.map(toCommentRange);
  }
  if (trailing && trailing.length > 0) {
    ksNode.trailingComments = trailing.map(toCommentRange);
  }
}

function findChild(ctx: ConvertContext, tsTarget: ts.Node | undefined): KSNode | undefined {
  if (!tsTarget) return undefined;
  return ctx.tsToKs.get(tsTarget);
}

function findChildrenOf(ctx: ConvertContext, tsTargets: ts.NodeArray<ts.Node> | readonly ts.Node[] | undefined): KSNode[] {
  if (!tsTargets) return [];
  return (tsTargets as readonly ts.Node[]).map((t) => ctx.tsToKs.get(t)!).filter(Boolean);
}

const SK = ts.SyntaxKind as unknown as Record<string, number>;

// ═══════════════════════════════════════════════════════════════════════
// Converter registry
// ═══════════════════════════════════════════════════════════════════════

type SpecificConverter = (
  ctx: ConvertContext,
  node: ts.Node,
  sf: ts.SourceFile,
  children: KSNode[],
  pos: number,
  end: number,
  text: string,
) => KSNode;

const specificConverters: Partial<Record<number, SpecificConverter>> = {};

function register(kind: number, converter: SpecificConverter): void {
  specificConverters[kind] = converter;
}

// ── Kind sets for rule-based extractors ──

const EXPORTED_DECLARATION_KINDS = new Set([
  'VariableStatement', 'VariableDeclaration', 'FunctionDeclaration',
  'ClassDeclaration', 'InterfaceDeclaration', 'TypeAliasDeclaration',
  'EnumDeclaration', 'ModuleDeclaration', 'MethodDeclaration', 'PropertyDeclaration',
]);

const SCOPE_CONTAINER_KINDS = new Set([
  'Block', 'FunctionDeclaration', 'FunctionExpression', 'ArrowFunction',
  'ModuleBlock', 'CaseClause', 'DefaultClause',
  'ForStatement', 'ForInStatement', 'ForOfStatement', 'Constructor',
]);

// Nodes that are JSDoc members (need extractJSDocComment for 'comment' prop)
const jsDocMembers = new Set<string>();
{
  for (const [kind, def] of Object.entries(NODES)) {
    if ((def.memberOf as readonly string[]).includes('JSDocNode')) {
      jsDocMembers.add(kind);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Schema-driven converter registration
// ═══════════════════════════════════════════════════════════════════════

const SKIP_CONVERT = new Set(['Program', 'CompilationUnit']);

// Nodes that have a typeString field — auto-detect getTypeString
const nodesWithTypeString = new Set<string>();
for (const [kind, def] of Object.entries(NODES)) {
  if ('typeString' in def.fields) nodesWithTypeString.add(kind);
}

/**
 * Extract a field value from a TS node using the schema definition.
 * Custom extractors take priority; otherwise uses generic extraction.
 */
function extractField(
  ctx: ConvertContext,
  kind: string,
  fname: string,
  field: FieldDescShape,
  n: Record<string, unknown>,
  node: ts.Node,
  children: KSNode[],
): unknown {
  // 1. Custom extractor
  const custom = CUSTOM_EXTRACTORS[kind]?.[fname];
  if (custom) return custom(ctx, n, node, children);

  // 2. Rule-based extractors
  if (fname === 'isExported' && EXPORTED_DECLARATION_KINDS.has(kind)) {
    return isNodeExported(node);
  }
  if (fname === 'localCount' && SCOPE_CONTAINER_KINDS.has(kind)) {
    return getLocalCount(ctx, node);
  }
  if (fname === 'typeString' && nodesWithTypeString.has(kind)) {
    return getTypeString(ctx, node);
  }

  // 3. Auto-detect: literal value/linkText → n.text
  if ((fname === 'value' || fname === 'linkText') && field.tag === 'prop' && field.propType === 'string') {
    return n.text ?? '';
  }

  // 4. JSDoc comment prop
  if (fname === 'comment' && field.tag === 'prop' && field.propType === 'string' && jsDocMembers.has(kind)) {
    return extractJSDocComment(n);
  }

  // 5. Generic extraction by field tag
  switch (field.tag) {
    case 'child': return findChild(ctx, n[fname] as ts.Node | undefined)!;
    case 'optChild': return findChild(ctx, n[fname] as ts.Node | undefined);
    case 'list': return findChildrenOf(ctx, n[fname] as ts.NodeArray<ts.Node> | undefined);
    case 'prop': {
      if (field.propType === 'boolean') return !!n[fname];
      if (field.propType === 'string') return n[fname] ?? '';
      if (field.propType === 'readonly number[]') return n[fname] ?? [];
      return n[fname];
    }
  }
}

// Register all converters from schema
for (const [kind, def] of Object.entries(NODES)) {
  if (SKIP_CONVERT.has(kind)) continue;

  const skNum = SK[kind];
  if (skNum === undefined) continue; // Kind not in TS SyntaxKind enum

  const fieldEntries = Object.entries(def.fields);

  if (fieldEntries.length === 0) {
    // Leaf node — no fields
    register(skNum, (_ctx, _node, _sf, children, pos, end, text) => ({
      kind, pos, end, text, children,
    } as KSNode));
  } else {
    // Node with fields
    register(skNum, (ctx, node, _sf, children, pos, end, text) => {
      const n = node as unknown as Record<string, unknown>;
      const result: Record<string, unknown> = { kind, pos, end, text, children };
      for (const [fname, field] of fieldEntries) {
        result[fname] = extractField(ctx, kind, fname, field, n, node, children);
      }
      return result as KSNode;
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Central dispatch
// ═══════════════════════════════════════════════════════════════════════

function convertNode(ctx: ConvertContext, node: ts.Node, sf: ts.SourceFile): KSNode {
  const children: KSNode[] = [];
  ts.forEachChild(node, (child) => {
    children.push(convertNode(ctx, child, sf));
  });

  const pos = node.getStart(sf);
  const end = node.getEnd();
  let text: string;
  try {
    text = node.getText(sf);
  } catch {
    text = '';
  }

  const converter = specificConverters[node.kind];
  if (converter) {
    const ksNode = converter(ctx, node, sf, children, pos, end, text);
    attachComments(ksNode, node, sf);
    ctx.tsToKs.set(node, ksNode);
    return ksNode;
  }

  throw new Error(`Unhandled SyntaxKind: ${ts.SyntaxKind[node.kind] ?? node.kind}`);
}

// ── SourceFile → CompilationUnit ──

function convertSourceFile(ctx: ConvertContext, sf: ts.SourceFile): KSCompilationUnit {
  const children: KSNode[] = [];
  ts.forEachChild(sf, (child) => {
    children.push(convertNode(ctx, child, sf));
  });

  const cu: KSCompilationUnit = {
    kind: 'CompilationUnit',
    fileName: sf.fileName,
    isDeclarationFile: sf.isDeclarationFile,
    sourceText: sf.getFullText(),
    lineStarts: sf.getLineStarts(),
    languageVariant: sf.languageVariant === ts.LanguageVariant.JSX ? 'JSX' : 'Standard',
    statements: children as KSStatement[],
    pos: sf.getStart(),
    end: sf.getEnd(),
    text: '',
    children,
  };
  ctx.tsToKs.set(sf, cu);
  return cu;
}

// ═══════════════════════════════════════════════════════════════════════
// Public API — Adapter: AstTranslatorPort<ts.Program, KSProgram, AnalysisDepth>
// ═══════════════════════════════════════════════════════════════════════

function buildKSTree(tsProgram: ts.Program, depth: AnalysisDepth = 'check'): KSTree {
  const ctx: ConvertContext = depth === 'parse'
    ? { checker: undefined, depth, tsToKs: new WeakMap() }
    : { checker: tsProgram.getTypeChecker(), depth, tsToKs: new WeakMap() };
  const compilationUnits: KSCompilationUnit[] = [];

  for (const sf of tsProgram.getSourceFiles()) {
    if (sf.isDeclarationFile) continue;
    compilationUnits.push(convertSourceFile(ctx, sf));
  }

  const root: KSProgram = {
    kind: 'Program',
    compilationUnits,
    pos: 0,
    end: 0,
    text: '',
    children: compilationUnits,
  };

  return { root };
}

/** Adapter: AstTranslatorPort — TS AST → KS AST converter. */
export const tsToAstTranslatorAdapter: AstTranslatorPort<ts.Program, KSProgram, AnalysisDepth> = {
  convert: buildKSTree,
};
