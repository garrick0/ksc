/**
 * Comprehensive integration test: walks the TS AST and KSC AST in parallel,
 * verifying structural completeness and field correctness for every node.
 *
 * Categories checked:
 *   structural      — children count/order, kind mapping
 *   position        — pos/end/text
 *   childField      — named child fields wired to correct KSC nodes
 *   identifier      — sym* flags, escapedText, isDefinitionSite, resolvedFileName,
 *                      importModuleSpecifier, resolvesToImport
 *   isExported      — export status on declaration nodes
 *   localCount      — scope container local symbol count
 *   typeString      — type-checker-derived type strings
 *   operator        — operator/declarationKind/token/keywordToken mappings
 *   isTypeOnly      — import/export type-only flags
 *   value           — literal node text values (StringLiteral, NumericLiteral, etc.)
 *   fieldPresence   — schema-driven: every prop field exists with correct JS type
 *   compilationUnit — fileName, sourceText, lineStarts, languageVariant
 *   other           — isExportEquals, resolvedModulePath, comment, etc.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { buildKSTree, type AnalysisDepth } from '../generated/ts-ast/grammar/convert.js';
import type { KSNode, KSCompilationUnit } from '../generated/ts-ast/grammar/node-types.js';
import { fieldDefs, allKinds } from '../generated/ts-ast/grammar/schema.js';

const FIXTURES = path.resolve(__dirname, 'fixtures');

// ────────────────────────────────────────────────────────────────────────
// SyntaxKind → KSC kind name mapping (resolves TS enum aliases)
// ────────────────────────────────────────────────────────────────────────

const TS_TO_KS_KIND = new Map<number, string>();
{
  const byValue = new Map<number, string[]>();
  for (const [name, value] of Object.entries(ts.SyntaxKind)) {
    if (typeof value !== 'number') continue;
    if (!byValue.has(value)) byValue.set(value, []);
    byValue.get(value)!.push(name);
  }
  for (const [value, names] of byValue) {
    const ksName = names.find(n => allKinds.has(n));
    if (ksName) TS_TO_KS_KIND.set(value, ksName);
  }
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

function createTSProgram(fixtureDir: string): ts.Program {
  const files = ts.sys.readDirectory(
    path.join(FIXTURES, fixtureDir, 'src'),
    ['.ts', '.tsx'],
  );
  return ts.createProgram(files, {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Node16,
    rootDir: path.join(FIXTURES, fixtureDir),
    jsx: ts.JsxEmit.React,
  });
}

function getTSChildren(node: ts.Node): ts.Node[] {
  const children: ts.Node[] = [];
  ts.forEachChild(node, child => { children.push(child); });
  return children;
}

// ────────────────────────────────────────────────────────────────────────
// Error categories
// ────────────────────────────────────────────────────────────────────────

type ErrorCategory =
  | 'structural'
  | 'position'
  | 'childField'
  | 'identifier'
  | 'isExported'
  | 'localCount'
  | 'typeString'
  | 'operator'
  | 'isTypeOnly'
  | 'value'
  | 'fieldPresence'
  | 'compilationUnit'
  | 'other';

interface VerificationError {
  category: ErrorCategory;
  path: string;
  message: string;
}

interface VerificationResult {
  errors: VerificationError[];
  nodesChecked: number;
  kindsChecked: Set<string>;
  counts: {
    exportedTrue: number;
    resolvesToImportTrue: number;
    nonEmptyValue: number;
    nonEmptyTypeString: number;
    nonEmptyComment: number;
    isTypeOnlyTrue: number;
    localCountNonZero: number;
    identifierTotal: number;
    binaryExpressionTotal: number;
  };
}

function addError(result: VerificationResult, category: ErrorCategory, nodePath: string, message: string) {
  result.errors.push({ category, path: nodePath, message });
}

// ────────────────────────────────────────────────────────────────────────
// Operator maps (for independent verification)
// ────────────────────────────────────────────────────────────────────────

const PREFIX_UNARY_OP: Record<number, string> = {
  [ts.SyntaxKind.PlusToken]: '+',
  [ts.SyntaxKind.MinusToken]: '-',
  [ts.SyntaxKind.TildeToken]: '~',
  [ts.SyntaxKind.ExclamationToken]: '!',
  [ts.SyntaxKind.PlusPlusToken]: '++',
  [ts.SyntaxKind.MinusMinusToken]: '--',
};

const POSTFIX_UNARY_OP: Record<number, string> = {
  [ts.SyntaxKind.PlusPlusToken]: '++',
  [ts.SyntaxKind.MinusMinusToken]: '--',
};

const TYPE_OPERATOR_MAP: Record<number, string> = {
  [ts.SyntaxKind.KeyOfKeyword]: 'keyof',
  [ts.SyntaxKind.UniqueKeyword]: 'unique',
  [ts.SyntaxKind.ReadonlyKeyword]: 'readonly',
};

const HERITAGE_TOKEN_MAP: Record<number, string> = {
  [ts.SyntaxKind.ExtendsKeyword]: 'extends',
  [ts.SyntaxKind.ImplementsKeyword]: 'implements',
};

const META_PROPERTY_MAP: Record<number, string> = {
  [ts.SyntaxKind.NewKeyword]: 'new',
  [ts.SyntaxKind.ImportKeyword]: 'import',
};

// ────────────────────────────────────────────────────────────────────────
// Expected JS types for prop fields based on typeRef
// ────────────────────────────────────────────────────────────────────────

function expectedJSType(typeRef: string | undefined): string | null {
  if (!typeRef) return null;
  if (typeRef === 'boolean') return 'boolean';
  if (typeRef === 'number') return 'number';
  if (typeRef === 'string') return 'string';
  if (typeRef === 'readonly number[]') return 'object'; // arrays
  if (typeRef.startsWith("'") || typeRef.includes("' | '")) return 'string'; // union of string literals
  return null; // can't determine
}

// ────────────────────────────────────────────────────────────────────────
// Independent computation helpers
// ────────────────────────────────────────────────────────────────────────

function checkIsDefinitionSite(tsNode: ts.Identifier): boolean {
  const parent = tsNode.parent;
  if (!parent) return false;
  if (ts.isVariableDeclaration(parent) && parent.name === tsNode) return true;
  if (ts.isParameter(parent) && parent.name === tsNode) return true;
  if (ts.isFunctionDeclaration(parent) && parent.name === tsNode) return true;
  if (ts.isClassDeclaration(parent) && parent.name === tsNode) return true;
  if (ts.isInterfaceDeclaration(parent) && parent.name === tsNode) return true;
  if (ts.isTypeAliasDeclaration(parent) && parent.name === tsNode) return true;
  if (ts.isEnumDeclaration(parent) && parent.name === tsNode) return true;
  if (ts.isEnumMember(parent) && parent.name === tsNode) return true;
  if (ts.isMethodDeclaration(parent) && parent.name === tsNode) return true;
  if (ts.isPropertyDeclaration(parent) && parent.name === tsNode) return true;
  if (ts.isPropertySignature(parent) && parent.name === tsNode) return true;
  if (ts.isMethodSignature(parent) && parent.name === tsNode) return true;
  if (ts.isGetAccessorDeclaration(parent) && parent.name === tsNode) return true;
  if (ts.isSetAccessorDeclaration(parent) && parent.name === tsNode) return true;
  if (ts.isImportSpecifier(parent) && (parent.name === tsNode || parent.propertyName === tsNode)) return true;
  if (ts.isImportClause(parent)) return true;
  if (ts.isNamespaceImport(parent)) return true;
  if (ts.isExportSpecifier(parent)) return true;
  if (ts.isBindingElement(parent) && parent.name === tsNode) return true;
  if (ts.isFunctionExpression(parent) && parent.name === tsNode) return true;
  return false;
}

function checkIsImportReference(tsNode: ts.Identifier, checker: ts.TypeChecker): boolean {
  const sym = checker.getSymbolAtLocation(tsNode);
  if (!sym) return false;
  if (!(sym.flags & ts.SymbolFlags.Alias)) return false;
  const parent = tsNode.parent;
  if (!parent) return false;
  if (ts.isImportSpecifier(parent) || ts.isImportClause(parent) || ts.isNamespaceImport(parent)) return false;
  if (ts.isTypeReferenceNode(parent) && parent.typeName === tsNode) return false;
  if (ts.isTypeQueryNode(parent)) return false;
  if (ts.isVariableDeclaration(parent) && parent.name === tsNode) return false;
  if (ts.isParameter(parent) && parent.name === tsNode) return false;
  if (ts.isFunctionDeclaration(parent) && parent.name === tsNode) return false;
  if (ts.isFunctionExpression(parent) && parent.name === tsNode) return false;
  if (ts.isPropertyAccessExpression(parent) && parent.name === tsNode) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === tsNode) return false;
  if (ts.isBindingElement(parent) && parent.name === tsNode) return false;
  if (ts.isPropertySignature(parent) && parent.name === tsNode) return false;
  if (ts.isTypeAliasDeclaration(parent) && parent.name === tsNode) return false;
  return true;
}

function checkIsExported(tsNode: ts.Node): boolean {
  const mods = (tsNode as any).modifiers;
  if (mods) {
    for (let i = 0; i < mods.length; i++) {
      if (mods[i].kind === ts.SyntaxKind.ExportKeyword) return true;
    }
  }
  if (tsNode.parent && ts.isExportAssignment(tsNode.parent)) return true;
  return false;
}

function checkDeclarationKind(flags: number): string {
  if (flags & ts.NodeFlags.Const) return 'const';
  if (flags & ts.NodeFlags.Let) return 'let';
  if (flags & (ts.NodeFlags as any).AwaitUsing) return 'await using';
  if (flags & (ts.NodeFlags as any).Using) return 'using';
  return 'var';
}

function checkImportModuleSpecifier(tsNode: ts.Identifier, checker: ts.TypeChecker): string {
  const sym = checker.getSymbolAtLocation(tsNode);
  if (!sym || !(sym.flags & ts.SymbolFlags.Alias)) return '';
  const decls = sym.declarations;
  if (!decls || decls.length === 0) return '';
  let current: ts.Node = decls[0];
  while (current && !ts.isImportDeclaration(current)) {
    current = current.parent;
  }
  if (!current || !ts.isImportDeclaration(current)) return '';
  const spec = current.moduleSpecifier;
  return ts.isStringLiteral(spec) ? spec.text : '';
}

function checkResolvedModulePath(tsNode: ts.ImportDeclaration, checker: ts.TypeChecker): string {
  const spec = tsNode.moduleSpecifier;
  if (!ts.isStringLiteral(spec)) return '';
  const sym = checker.getSymbolAtLocation(spec);
  if (!sym) return '';
  const decls = sym.declarations;
  if (!decls || decls.length === 0) return '';
  return decls[0].getSourceFile().fileName;
}

function checkJSDocComment(tsNode: ts.Node): string {
  const c = (tsNode as any).comment;
  if (!c) return '';
  if (typeof c === 'string') return c;
  return '';
}

// ────────────────────────────────────────────────────────────────────────
// SyntaxKinds that carry specific fields
// ────────────────────────────────────────────────────────────────────────

const EXPORT_KINDS = new Set([
  ts.SyntaxKind.VariableStatement, ts.SyntaxKind.VariableDeclaration,
  ts.SyntaxKind.FunctionDeclaration, ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.InterfaceDeclaration, ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.EnumDeclaration, ts.SyntaxKind.ModuleDeclaration,
  ts.SyntaxKind.MethodDeclaration, ts.SyntaxKind.PropertyDeclaration,
]);

const TYPE_ONLY_KINDS = new Set([
  ts.SyntaxKind.ImportClause, ts.SyntaxKind.ImportSpecifier,
  ts.SyntaxKind.ExportDeclaration, ts.SyntaxKind.ExportSpecifier,
  ts.SyntaxKind.ImportEqualsDeclaration,
]);

const LITERAL_VALUE_KINDS = new Set([
  'StringLiteral', 'NumericLiteral', 'BigIntLiteral',
  'RegularExpressionLiteral', 'NoSubstitutionTemplateLiteral',
  'TemplateHead', 'TemplateMiddle', 'TemplateTail', 'JsxText',
]);

const JSDOC_COMMENT_KINDS = new Set([
  'JSDocTag', 'JSDocParameterTag', 'JSDocReturnTag', 'JSDocTypeTag',
  'JSDocTemplateTag', 'JSDocImplementsTag', 'JSDocAugmentsTag',
  'JSDocDeprecatedTag', 'JSDocSeeTag', 'JSDocThrowsTag', 'JSDocOverrideTag',
  'JSDocPublicTag', 'JSDocPrivateTag', 'JSDocProtectedTag', 'JSDocReadonlyTag',
  'JSDocClassTag', 'JSDocPropertyTag', 'JSDocTypedefTag', 'JSDocCallbackTag',
  'JSDocSatisfiesTag', 'JSDocOverloadTag', 'JSDocImportTag',
  'JSDocComment',
]);

// ────────────────────────────────────────────────────────────────────────
// Verify named child fields
// ────────────────────────────────────────────────────────────────────────

function verifyChildFields(
  tsNode: ts.Node, ksNode: KSNode, sf: ts.SourceFile,
  result: VerificationResult, nodePath: string,
): void {
  const defs = fieldDefs[ksNode.kind];
  if (!defs) return;

  for (const def of defs) {
    if (def.tag === 'prop') continue;
    const tsValue = (tsNode as any)[def.name];
    const ksValue = (ksNode as any)[def.name];

    if (def.tag === 'child') {
      if (tsValue == null && ksValue == null) continue;
      if (tsValue == null || ksValue == null) {
        addError(result, 'childField', nodePath,
          `field '${def.name}': one side null (TS: ${tsValue == null}, KS: ${ksValue == null})`);
        continue;
      }
      const tsChildPos = tsValue.getStart(sf);
      const tsChildEnd = tsValue.getEnd();
      if (ksValue.pos !== tsChildPos || ksValue.end !== tsChildEnd) {
        addError(result, 'childField', nodePath,
          `field '${def.name}': pos mismatch (TS: ${tsChildPos}:${tsChildEnd}, KS: ${ksValue.pos}:${ksValue.end})`);
      }
    } else if (def.tag === 'optChild') {
      if (tsValue == null && ksValue == null) continue;
      if ((tsValue == null) !== (ksValue == null)) {
        addError(result, 'childField', nodePath,
          `field '${def.name}': TS is ${tsValue == null ? 'null' : 'present'}, KS is ${ksValue == null ? 'null' : 'present'}`);
        continue;
      }
      const tsChildPos = tsValue.getStart(sf);
      const tsChildEnd = tsValue.getEnd();
      if (ksValue.pos !== tsChildPos || ksValue.end !== tsChildEnd) {
        addError(result, 'childField', nodePath,
          `field '${def.name}': pos mismatch (TS: ${tsChildPos}:${tsChildEnd}, KS: ${ksValue.pos}:${ksValue.end})`);
      }
    } else if (def.tag === 'list') {
      const tsList: ts.Node[] = tsValue ? Array.from(tsValue) : [];
      const ksList: KSNode[] = ksValue ?? [];
      if (tsList.length !== ksList.length) {
        addError(result, 'childField', nodePath,
          `field '${def.name}': list length mismatch (TS: ${tsList.length}, KS: ${ksList.length})`);
      }
      const len = Math.min(tsList.length, ksList.length);
      for (let i = 0; i < len; i++) {
        const tsChildPos = tsList[i].getStart(sf);
        const tsChildEnd = tsList[i].getEnd();
        if (ksList[i].pos !== tsChildPos || ksList[i].end !== tsChildEnd) {
          addError(result, 'childField', nodePath,
            `field '${def.name}[${i}]': pos mismatch (TS: ${tsChildPos}:${tsChildEnd}, KS: ${ksList[i].pos}:${ksList[i].end})`);
        }
      }
    }
  }
}

// ────────────────────────────────────────────────────────────────────────
// Schema-driven field presence / type check (Option C)
// ────────────────────────────────────────────────────────────────────────

function verifyFieldPresence(
  ksNode: KSNode, result: VerificationResult, nodePath: string,
): void {
  const defs = fieldDefs[ksNode.kind];
  if (!defs) return;

  const ks = ksNode as any;
  for (const def of defs) {
    if (def.tag !== 'prop') continue;

    // Check field exists
    if (!(def.name in ks)) {
      addError(result, 'fieldPresence', nodePath,
        `missing prop '${def.name}' (expected type: ${def.typeRef})`);
      continue;
    }

    // Check JS type
    const jsType = expectedJSType(def.typeRef);
    if (jsType && typeof ks[def.name] !== jsType) {
      addError(result, 'fieldPresence', nodePath,
        `prop '${def.name}': expected typeof '${jsType}', got '${typeof ks[def.name]}'`);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────
// Verify computed / prop fields (deep value checks)
// ────────────────────────────────────────────────────────────────────────

function verifyComputedFields(
  tsNode: ts.Node, ksNode: KSNode, checker: ts.TypeChecker | null,
  sf: ts.SourceFile, result: VerificationResult, nodePath: string,
): void {
  const ks = ksNode as any;

  // ── Track kind counts ──
  if (ts.isIdentifier(tsNode)) result.counts.identifierTotal++;
  if (ts.isBinaryExpression(tsNode)) result.counts.binaryExpressionTotal++;

  // ── Identifier ──
  if (ts.isIdentifier(tsNode)) {
    const expectedText = tsNode.escapedText as string;
    if (ks.escapedText !== expectedText) {
      addError(result, 'identifier', nodePath,
        `escapedText: expected '${expectedText}', got '${ks.escapedText}'`);
    }

    if (checker) {
      // sym* flags
      const sym = checker.getSymbolAtLocation(tsNode);
      const symChecks: [string, ts.SymbolFlags][] = [
        ['symIsVariable', ts.SymbolFlags.Variable],
        ['symIsFunctionScopedVariable', ts.SymbolFlags.FunctionScopedVariable],
        ['symIsBlockScopedVariable', ts.SymbolFlags.BlockScopedVariable],
        ['symIsFunction', ts.SymbolFlags.Function],
        ['symIsClass', ts.SymbolFlags.Class],
        ['symIsInterface', ts.SymbolFlags.Interface],
        ['symIsTypeAlias', ts.SymbolFlags.TypeAlias],
        ['symIsAlias', ts.SymbolFlags.Alias],
        ['symIsProperty', ts.SymbolFlags.Property],
        ['symIsMethod', ts.SymbolFlags.Method],
        ['symIsEnum', ts.SymbolFlags.Enum],
        ['symIsEnumMember', ts.SymbolFlags.EnumMember],
        ['symIsNamespace', ts.SymbolFlags.NamespaceModule],
        ['symIsExportValue', ts.SymbolFlags.ExportValue],
        ['symIsType', ts.SymbolFlags.Type],
        ['symIsValue', ts.SymbolFlags.Value],
      ];
      for (const [field, flag] of symChecks) {
        const expected = sym ? !!(sym.flags & flag) : false;
        if (ks[field] !== expected) {
          addError(result, 'identifier', nodePath,
            `${field}: expected ${expected}, got ${ks[field]} (text: '${expectedText}')`);
        }
      }

      // isDefinitionSite
      const expectedDefSite = checkIsDefinitionSite(tsNode);
      if (ks.isDefinitionSite !== expectedDefSite) {
        addError(result, 'identifier', nodePath,
          `isDefinitionSite: expected ${expectedDefSite}, got ${ks.isDefinitionSite} (text: '${expectedText}')`);
      }

      // resolvesToImport
      const expectedImportRef = checkIsImportReference(tsNode, checker);
      if (ks.resolvesToImport !== expectedImportRef) {
        addError(result, 'identifier', nodePath,
          `resolvesToImport: expected ${expectedImportRef}, got ${ks.resolvesToImport} (text: '${expectedText}')`);
      }
      if (expectedImportRef) result.counts.resolvesToImportTrue++;

      // resolvedFileName
      if (sym && (sym.flags & ts.SymbolFlags.Alias)) {
        try {
          const resolved = checker.getAliasedSymbol(sym);
          const decl = resolved.declarations?.[0];
          const expectedFile = decl ? decl.getSourceFile().fileName : '';
          if (ks.resolvedFileName !== expectedFile) {
            addError(result, 'identifier', nodePath,
              `resolvedFileName: expected '...${path.basename(expectedFile)}', got '...${path.basename(ks.resolvedFileName)}' (text: '${expectedText}')`);
          }
        } catch { /* some aliases can't be resolved */ }
      } else {
        // Non-alias: resolvedFileName should be ''
        if (ks.resolvedFileName !== '') {
          addError(result, 'identifier', nodePath,
            `resolvedFileName: expected '' (non-alias), got '${ks.resolvedFileName}' (text: '${expectedText}')`);
        }
      }

      // importModuleSpecifier
      const expectedModSpec = checkImportModuleSpecifier(tsNode, checker);
      if (ks.importModuleSpecifier !== expectedModSpec) {
        addError(result, 'identifier', nodePath,
          `importModuleSpecifier: expected '${expectedModSpec}', got '${ks.importModuleSpecifier}' (text: '${expectedText}')`);
      }
    }
  }

  // ── PrivateIdentifier ──
  if (tsNode.kind === ts.SyntaxKind.PrivateIdentifier) {
    const expectedText = (tsNode as ts.PrivateIdentifier).escapedText as string;
    if (ks.escapedText !== expectedText) {
      addError(result, 'identifier', nodePath,
        `PrivateIdentifier escapedText: expected '${expectedText}', got '${ks.escapedText}'`);
    }
  }

  // ── value on literal nodes ──
  if (LITERAL_VALUE_KINDS.has(ksNode.kind)) {
    const expectedValue = (tsNode as any).text ?? '';
    if (ks.value !== expectedValue) {
      addError(result, 'value', nodePath,
        `value: expected '${expectedValue}', got '${ks.value}' (kind: ${ksNode.kind})`);
    }
    if (expectedValue) result.counts.nonEmptyValue++;
  }

  // ── containsOnlyTriviaWhiteSpaces on JsxText ──
  if (ksNode.kind === 'JsxText') {
    const expected = !!(tsNode as any).containsOnlyTriviaWhiteSpaces;
    if (ks.containsOnlyTriviaWhiteSpaces !== expected) {
      addError(result, 'value', nodePath,
        `containsOnlyTriviaWhiteSpaces: expected ${expected}, got ${ks.containsOnlyTriviaWhiteSpaces}`);
    }
  }

  // ── comment on JSDoc nodes ──
  if (JSDOC_COMMENT_KINDS.has(ksNode.kind) && 'comment' in ks) {
    const expected = checkJSDocComment(tsNode);
    if (ks.comment !== expected) {
      addError(result, 'other', nodePath,
        `comment: expected '${expected.slice(0, 50)}', got '${String(ks.comment).slice(0, 50)}' (kind: ${ksNode.kind})`);
    }
    if (expected) result.counts.nonEmptyComment++;
  }

  // ── isExported ──
  if (EXPORT_KINDS.has(tsNode.kind)) {
    const expected = checkIsExported(tsNode);
    if (ks.isExported !== expected) {
      addError(result, 'isExported', nodePath,
        `isExported: expected ${expected}, got ${ks.isExported} (kind: ${ksNode.kind})`);
    }
    if (expected) result.counts.exportedTrue++;
  }

  // ── localCount ──
  if ('localCount' in ks) {
    const expected = (tsNode as any).locals?.size ?? 0;
    if (ks.localCount !== expected) {
      addError(result, 'localCount', nodePath,
        `localCount: expected ${expected}, got ${ks.localCount}`);
    }
    if (expected > 0) result.counts.localCountNonZero++;
  }

  // ── typeString ──
  if ('typeString' in ks && checker) {
    try {
      const type = checker.getTypeAtLocation(tsNode);
      const expected = checker.typeToString(type);
      if (ks.typeString !== expected) {
        addError(result, 'typeString', nodePath,
          `typeString: expected '${expected}', got '${ks.typeString}'`);
      }
      if (expected) result.counts.nonEmptyTypeString++;
    } catch { /* some nodes can't have type resolved */ }
  }

  // ── declarationKind ──
  if (ts.isVariableDeclarationList(tsNode)) {
    const expected = checkDeclarationKind(tsNode.flags);
    if (ks.declarationKind !== expected) {
      addError(result, 'operator', nodePath,
        `declarationKind: expected '${expected}', got '${ks.declarationKind}'`);
    }
  }

  // ── operator on PrefixUnaryExpression ──
  if (ts.isPrefixUnaryExpression(tsNode)) {
    const expected = PREFIX_UNARY_OP[tsNode.operator];
    if (ks.operator !== expected) {
      addError(result, 'operator', nodePath,
        `PrefixUnary operator: expected '${expected}', got '${ks.operator}'`);
    }
  }

  // ── operator on PostfixUnaryExpression ──
  if (ts.isPostfixUnaryExpression(tsNode)) {
    const expected = POSTFIX_UNARY_OP[tsNode.operator];
    if (ks.operator !== expected) {
      addError(result, 'operator', nodePath,
        `PostfixUnary operator: expected '${expected}', got '${ks.operator}'`);
    }
  }

  // ── operator on TypeOperator ──
  if (tsNode.kind === ts.SyntaxKind.TypeOperator) {
    const expected = TYPE_OPERATOR_MAP[(tsNode as ts.TypeOperatorNode).operator];
    if (ks.operator !== expected) {
      addError(result, 'operator', nodePath,
        `TypeOperator operator: expected '${expected}', got '${ks.operator}'`);
    }
  }

  // ── token on HeritageClause ──
  if (ts.isHeritageClause(tsNode)) {
    const expected = HERITAGE_TOKEN_MAP[tsNode.token];
    if (ks.token !== expected) {
      addError(result, 'operator', nodePath,
        `HeritageClause token: expected '${expected}', got '${ks.token}'`);
    }
  }

  // ── keywordToken on MetaProperty ──
  if (ts.isMetaProperty(tsNode)) {
    const expected = META_PROPERTY_MAP[tsNode.keywordToken];
    if (ks.keywordToken !== expected) {
      addError(result, 'operator', nodePath,
        `MetaProperty keywordToken: expected '${expected}', got '${ks.keywordToken}'`);
    }
  }

  // ── isTypeOnly ──
  if (TYPE_ONLY_KINDS.has(tsNode.kind)) {
    const expected = !!(tsNode as any).isTypeOnly;
    if (ks.isTypeOnly !== expected) {
      addError(result, 'isTypeOnly', nodePath,
        `isTypeOnly: expected ${expected}, got ${ks.isTypeOnly}`);
    }
    if (expected) result.counts.isTypeOnlyTrue++;
  }

  // ── isExportEquals on ExportAssignment ──
  if (tsNode.kind === ts.SyntaxKind.ExportAssignment) {
    const expected = !!(tsNode as ts.ExportAssignment).isExportEquals;
    if (ks.isExportEquals !== expected) {
      addError(result, 'other', nodePath, `isExportEquals: expected ${expected}, got ${ks.isExportEquals}`);
    }
  }

  // ── isTypeOf on ImportType ──
  if (ksNode.kind === 'ImportType') {
    const expected = !!(tsNode as any).isTypeOf;
    if (ks.isTypeOf !== expected) {
      addError(result, 'other', nodePath, `isTypeOf: expected ${expected}, got ${ks.isTypeOf}`);
    }
  }

  // ── isBracketed on JSDocParameterTag / JSDocPropertyTag ──
  if (ksNode.kind === 'JSDocParameterTag' || ksNode.kind === 'JSDocPropertyTag') {
    const expected = !!(tsNode as any).isBracketed;
    if (ks.isBracketed !== expected) {
      addError(result, 'other', nodePath, `isBracketed: expected ${expected}, got ${ks.isBracketed}`);
    }
  }

  // ── isArrayType on JSDocTypeLiteral ──
  if (ksNode.kind === 'JSDocTypeLiteral') {
    const expected = !!(tsNode as any).isArrayType;
    if (ks.isArrayType !== expected) {
      addError(result, 'other', nodePath, `isArrayType: expected ${expected}, got ${ks.isArrayType}`);
    }
  }

  // ── linkText on JSDocLink / JSDocLinkCode / JSDocLinkPlain ──
  if (ksNode.kind === 'JSDocLink' || ksNode.kind === 'JSDocLinkCode' || ksNode.kind === 'JSDocLinkPlain') {
    const expected = (tsNode as any).text ?? '';
    if (ks.linkText !== expected) {
      addError(result, 'other', nodePath, `linkText: expected '${expected}', got '${ks.linkText}'`);
    }
  }

  // ── resolvedModulePath on ImportDeclaration ──
  if (ts.isImportDeclaration(tsNode) && checker) {
    const expected = checkResolvedModulePath(tsNode, checker);
    if (ks.resolvedModulePath !== expected) {
      addError(result, 'other', nodePath,
        `resolvedModulePath: expected '...${path.basename(expected)}', got '...${path.basename(ks.resolvedModulePath ?? '')}'`);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────
// Recursive parallel walker
// ────────────────────────────────────────────────────────────────────────

function verifyNode(
  tsNode: ts.Node, ksNode: KSNode, checker: ts.TypeChecker | null,
  sf: ts.SourceFile, result: VerificationResult, nodePath: string,
): void {
  result.nodesChecked++;
  result.kindsChecked.add(ksNode.kind);

  const expectedKind = TS_TO_KS_KIND.get(tsNode.kind) ?? ts.SyntaxKind[tsNode.kind];
  if (ksNode.kind !== expectedKind) {
    addError(result, 'structural', nodePath,
      `kind mismatch: expected '${expectedKind}', got '${ksNode.kind}'`);
    return;
  }

  // Position
  const tsPos = tsNode.getStart(sf);
  const tsEnd = tsNode.getEnd();
  if (ksNode.pos !== tsPos) addError(result, 'position', nodePath, `pos: expected ${tsPos}, got ${ksNode.pos}`);
  if (ksNode.end !== tsEnd) addError(result, 'position', nodePath, `end: expected ${tsEnd}, got ${ksNode.end}`);

  // Text
  try {
    const expectedText = tsNode.getText(sf);
    if (ksNode.text !== expectedText) {
      addError(result, 'position', nodePath,
        `text mismatch (length: expected ${expectedText.length}, got ${ksNode.text.length})`);
    }
  } catch {}

  // Named child fields
  verifyChildFields(tsNode, ksNode, sf, result, nodePath);

  // Schema-driven field presence + type check
  verifyFieldPresence(ksNode, result, nodePath);

  // Computed / prop value checks
  verifyComputedFields(tsNode, ksNode, checker, sf, result, nodePath);

  // Structural: children count and order (recursive)
  const tsChildren = getTSChildren(tsNode);
  const ksChildren = ksNode.children;
  if (tsChildren.length !== ksChildren.length) {
    addError(result, 'structural', nodePath,
      `child count: TS has ${tsChildren.length}, KS has ${ksChildren.length}`);
  }
  const count = Math.min(tsChildren.length, ksChildren.length);
  for (let i = 0; i < count; i++) {
    const childKindName = TS_TO_KS_KIND.get(tsChildren[i].kind) ?? ts.SyntaxKind[tsChildren[i].kind];
    verifyNode(tsChildren[i], ksChildren[i], checker, sf, result,
      `${nodePath}/${childKindName}[${i}]`);
  }
}

// ────────────────────────────────────────────────────────────────────────
// CompilationUnit verification
// ────────────────────────────────────────────────────────────────────────

function verifyCompilationUnit(sf: ts.SourceFile, cu: KSCompilationUnit, result: VerificationResult): void {
  const p = `CU(${path.basename(sf.fileName)})`;
  if (cu.fileName !== sf.fileName) addError(result, 'compilationUnit', p, `fileName mismatch`);
  if (cu.isDeclarationFile !== sf.isDeclarationFile) addError(result, 'compilationUnit', p, `isDeclarationFile mismatch`);
  if (cu.sourceText !== sf.getFullText()) addError(result, 'compilationUnit', p, `sourceText mismatch`);
  if (cu.lineStarts.length !== sf.getLineStarts().length) addError(result, 'compilationUnit', p, `lineStarts length mismatch`);
  const expectedVariant = sf.languageVariant === ts.LanguageVariant.JSX ? 'JSX' : 'Standard';
  if (cu.languageVariant !== expectedVariant) addError(result, 'compilationUnit', p, `languageVariant: expected '${expectedVariant}', got '${cu.languageVariant}'`);
}

// ────────────────────────────────────────────────────────────────────────
// Walk all source files at a given depth
// ────────────────────────────────────────────────────────────────────────

function walkFixture(depth: AnalysisDepth): VerificationResult {
  const tsProgram = createTSProgram('integration');
  const ksTree = buildKSTree(tsProgram, depth);
  const checker = depth !== 'parse' ? tsProgram.getTypeChecker() : null;

  const result: VerificationResult = {
    errors: [], nodesChecked: 0, kindsChecked: new Set(),
    counts: {
      exportedTrue: 0, resolvesToImportTrue: 0, nonEmptyValue: 0,
      nonEmptyTypeString: 0, nonEmptyComment: 0, isTypeOnlyTrue: 0,
      localCountNonZero: 0, identifierTotal: 0, binaryExpressionTotal: 0,
    },
  };

  for (const sf of tsProgram.getSourceFiles()) {
    if (sf.isDeclarationFile) continue;
    const cu = ksTree.root.compilationUnits.find(c => c.fileName === sf.fileName);
    if (!cu) { addError(result, 'structural', 'root', `No CU for ${sf.fileName}`); continue; }

    verifyCompilationUnit(sf, cu, result);

    const tsChildren = getTSChildren(sf);
    const ksChildren = cu.children;
    const basePath = path.basename(sf.fileName);

    if (tsChildren.length !== ksChildren.length) {
      addError(result, 'structural', basePath,
        `top-level child count: TS has ${tsChildren.length}, KS has ${ksChildren.length}`);
    }
    const count = Math.min(tsChildren.length, ksChildren.length);
    for (let i = 0; i < count; i++) {
      const childKindName = TS_TO_KS_KIND.get(tsChildren[i].kind) ?? ts.SyntaxKind[tsChildren[i].kind];
      verifyNode(tsChildren[i], ksChildren[i], checker, sf, result,
        `${basePath}/${childKindName}[${i}]`);
    }
  }
  return result;
}

// ────────────────────────────────────────────────────────────────────────
// Format error report
// ────────────────────────────────────────────────────────────────────────

function formatErrors(errors: VerificationError[], limit = 30): string {
  const lines = errors.slice(0, limit).map(e => `  ${e.path}: ${e.message}`);
  if (errors.length > limit) lines.push(`  ... and ${errors.length - limit} more`);
  return lines.join('\n');
}

function expectNoErrors(result: VerificationResult, category: ErrorCategory) {
  const errs = result.errors.filter(e => e.category === category);
  expect(errs, `${errs.length} ${category} errors:\n${formatErrors(errs)}`).toHaveLength(0);
}

// ════════════════════════════════════════════════════════════════════════
// Tests — full check depth
// ════════════════════════════════════════════════════════════════════════

describe('integration — KSC ↔ TS AST fidelity (check depth)', () => {
  let result: VerificationResult;
  beforeAll(() => { result = walkFixture('check'); });

  it('structural completeness', () => expectNoErrors(result, 'structural'));
  it('pos/end/text match', () => expectNoErrors(result, 'position'));
  it('named child fields wired correctly', () => expectNoErrors(result, 'childField'));
  it('Identifier fields (sym*, isDefinitionSite, resolvedFileName, resolvesToImport, importModuleSpecifier)', () => expectNoErrors(result, 'identifier'));
  it('isExported matches', () => expectNoErrors(result, 'isExported'));
  it('localCount matches', () => expectNoErrors(result, 'localCount'));
  it('typeString matches', () => expectNoErrors(result, 'typeString'));
  it('operator/declarationKind/token mappings', () => expectNoErrors(result, 'operator'));
  it('isTypeOnly matches', () => expectNoErrors(result, 'isTypeOnly'));
  it('literal value fields match', () => expectNoErrors(result, 'value'));
  it('every prop field exists with correct JS type', () => expectNoErrors(result, 'fieldPresence'));
  it('CompilationUnit properties', () => expectNoErrors(result, 'compilationUnit'));
  it('other fields (resolvedModulePath, isExportEquals, JSDoc comment)', () => expectNoErrors(result, 'other'));

  it('exercises >= 150 unique node kinds', () => {
    expect(result.kindsChecked.size).toBeGreaterThanOrEqual(150);
  });

  it('verifies >= 1000 nodes', () => {
    expect(result.nodesChecked).toBeGreaterThanOrEqual(1000);
  });

  it('minimum-true counts: fields are not trivially all-false', () => {
    // Guard against regressions where a field silently becomes always-false/empty
    expect(result.counts.exportedTrue, 'at least 5 nodes should have isExported=true').toBeGreaterThanOrEqual(5);
    expect(result.counts.resolvesToImportTrue, 'at least 2 identifiers should resolve to imports').toBeGreaterThanOrEqual(2);
    expect(result.counts.nonEmptyValue, 'at least 10 literal nodes should have non-empty value').toBeGreaterThanOrEqual(10);
    expect(result.counts.nonEmptyTypeString, 'at least 20 nodes should have non-empty typeString').toBeGreaterThanOrEqual(20);
    expect(result.counts.isTypeOnlyTrue, 'at least 1 type-only import/export').toBeGreaterThanOrEqual(1);
    expect(result.counts.localCountNonZero, 'at least 3 scopes with locals').toBeGreaterThanOrEqual(3);
    expect(result.counts.identifierTotal, 'at least 100 identifiers').toBeGreaterThanOrEqual(100);
    expect(result.counts.binaryExpressionTotal, 'at least 10 binary expressions').toBeGreaterThanOrEqual(10);
  });
});

// ════════════════════════════════════════════════════════════════════════
// Tests — depth degradation (Option D)
// ════════════════════════════════════════════════════════════════════════

describe('integration — depth degradation', () => {
  it('parse depth: structural integrity holds', () => {
    const result = walkFixture('parse');
    expectNoErrors(result, 'structural');
    expectNoErrors(result, 'position');
    expectNoErrors(result, 'childField');
    expectNoErrors(result, 'fieldPresence');
    expectNoErrors(result, 'value');
    expectNoErrors(result, 'operator');
  });

  it('parse depth: checker-dependent fields have defaults', () => {
    const tsProgram = createTSProgram('integration');
    const ksTree = buildKSTree(tsProgram, 'parse');
    let identCount = 0;
    let typeStringCount = 0;

    function walk(node: KSNode) {
      const ks = node as any;
      if (node.kind === 'Identifier') {
        identCount++;
        expect(ks.symIsFunction).toBe(false);
        expect(ks.symIsClass).toBe(false);
        expect(ks.symIsAlias).toBe(false);
        expect(ks.symIsVariable).toBe(false);
        expect(ks.resolvesToImport).toBe(false);
        expect(ks.resolvedFileName).toBe('');
        expect(ks.importModuleSpecifier).toBe('');
      }
      if ('typeString' in ks) {
        typeStringCount++;
        expect(ks.typeString).toBe('');
      }
      if ('localCount' in ks) {
        expect(ks.localCount).toBe(0);
      }
      for (const child of node.children) walk(child);
    }

    for (const cu of ksTree.root.compilationUnits) walk(cu);
    expect(identCount).toBeGreaterThan(50);
    expect(typeStringCount).toBeGreaterThan(50);
  });

  it('bind depth: structural integrity holds', () => {
    const result = walkFixture('bind');
    expectNoErrors(result, 'structural');
    expectNoErrors(result, 'position');
    expectNoErrors(result, 'childField');
    expectNoErrors(result, 'fieldPresence');
  });

  it('bind depth: typeString is empty, sym* flags populated', () => {
    const tsProgram = createTSProgram('integration');
    const ksTree = buildKSTree(tsProgram, 'bind');
    let symPopulated = false;

    function walk(node: KSNode) {
      const ks = node as any;
      if ('typeString' in ks) {
        expect(ks.typeString).toBe('');
      }
      if (node.kind === 'Identifier') {
        // At bind depth, sym* flags should be populated (at least some true)
        if (ks.symIsFunction || ks.symIsClass || ks.symIsVariable || ks.symIsAlias) {
          symPopulated = true;
        }
      }
      for (const child of node.children) walk(child);
    }

    for (const cu of ksTree.root.compilationUnits) walk(cu);
    expect(symPopulated).toBe(true);
  });

  it('bind depth: sym* flags match TS checker at bind level', () => {
    const result = walkFixture('bind');
    // At bind depth, checker is available, so sym* should be correct
    expectNoErrors(result, 'identifier');
  });

  it('bind depth: isExported is correct', () => {
    const result = walkFixture('bind');
    expectNoErrors(result, 'isExported');
  });

  it('bind depth: localCount is correct', () => {
    const result = walkFixture('bind');
    expectNoErrors(result, 'localCount');
  });
});
