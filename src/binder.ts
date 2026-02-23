/**
 * The KindScript Binder.
 *
 * Walks TypeScript's symbols after ts.createProgram(), finds Kind types
 * (via the __ks phantom marker), extracts PropertySpecs, and builds the
 * KindSymbolTable.
 *
 * Algorithm (4 steps):
 *   Step 1: Walk type alias declarations, detect __ks marker
 *   Step 2: Extract PropertySpec from type arguments
 *   Step 3: Walk value declarations for kind-annotated variables
 *   Step 4: Assemble the KindSymbolTable
 */

import ts from 'typescript';
import type { KindSymbolTable, KindSymbol, PropertySpec } from './types.js';

// ── Detection ──────────────────────────────────────────────────────────

/**
 * Structural check for the Kind marker. Every type produced by Kind<Base, Props>
 * resolves to Base & { readonly __ks?: true }. We detect it by asking TS:
 * "does this type have a property called __ks?"
 */
function isKindType(type: ts.Type): boolean {
  return type.getProperty('__ks') !== undefined;
}

// ── Symbol resolution ──────────────────────────────────────────────────

/** Resolve an alias symbol to its target. Import aliases → original symbol. */
function resolveSymbol(symbol: ts.Symbol, checker: ts.TypeChecker): ts.Symbol {
  if (symbol.flags & ts.SymbolFlags.Alias) {
    return checker.getAliasedSymbol(symbol);
  }
  return symbol;
}

// ── Tuple/array extraction helpers ─────────────────────────────────────

/** Check if a type is a tuple type (ObjectFlags.Tuple on the target). */
function isTupleType(type: ts.Type): boolean {
  if (!(type.flags & ts.TypeFlags.Object)) return false;
  const objType = type as ts.ObjectType;
  if (!(objType.objectFlags & ts.ObjectFlags.Reference)) return false;
  const target = (type as ts.TypeReference).target;
  return !!(target.objectFlags & ts.ObjectFlags.Tuple);
}

/** Get the element types of a tuple type. */
function getTupleElements(type: ts.Type, checker: ts.TypeChecker): readonly ts.Type[] {
  if (!isTupleType(type)) return [];
  return checker.getTypeArguments(type as ts.TypeReference);
}

/**
 * Extract string literal values from a tuple type.
 * e.g. ["domain", "infrastructure"] → ["domain", "infrastructure"]
 */
function extractStringArray(type: ts.Type, checker: ts.TypeChecker): string[] {
  const elements = getTupleElements(type, checker);
  const result: string[] = [];
  for (const el of elements) {
    if (el.isStringLiteral()) {
      result.push(el.value);
    }
  }
  return result;
}

/**
 * Extract pairs of string literals from a tuple-of-tuples type.
 * e.g. [["domain", "infrastructure"]] → [["domain", "infrastructure"]]
 */
function extractStringTuplePairs(type: ts.Type, checker: ts.TypeChecker): Array<[string, string]> {
  const outerElements = getTupleElements(type, checker);
  const pairs: Array<[string, string]> = [];
  for (const element of outerElements) {
    const innerElements = getTupleElements(element, checker);
    if (
      innerElements.length === 2 &&
      innerElements[0].isStringLiteral() &&
      innerElements[1].isStringLiteral()
    ) {
      pairs.push([innerElements[0].value, innerElements[1].value]);
    }
  }
  return pairs;
}

// ── PropertySpec extraction ────────────────────────────────────────────

/**
 * Extract a PropertySpec from a type node (the second type argument of Kind<Base, Props>).
 * Reads each property from the resolved type and maps known property names
 * to their runtime representations.
 */
function extractPropertySpecFromNode(
  node: ts.TypeNode,
  checker: ts.TypeChecker,
): PropertySpec {
  const type = checker.getTypeAtLocation(node);
  const spec: PropertySpec = {};

  for (const prop of type.getProperties()) {
    const name = prop.getName();
    if (name === '__ks') continue; // Skip the phantom marker

    const propType = checker.getTypeOfSymbol(prop);

    switch (name) {
      // Boolean properties — presence means true
      case 'pure':
      case 'noIO':
      case 'noImports':
      case 'noMutation':
      case 'noConsole':
      case 'immutable':
      case 'static':
      case 'noSideEffects':
      case 'exhaustive':
      case 'noSiblingDependency':
        spec[name] = true;
        break;

      // Numeric properties
      case 'maxFanOut':
        if (propType.isNumberLiteral()) {
          spec.maxFanOut = propType.value;
        }
        break;

      // String literal properties
      case 'scope':
        if (propType.isStringLiteral()) {
          spec.scope = propType.value as 'folder' | 'file';
        }
        break;

      // Tuple array properties
      case 'noDependency':
      case 'noTransitiveDependency':
        spec[name] = extractStringTuplePairs(propType, checker);
        break;

      case 'noCycles':
        spec.noCycles = extractStringArray(propType, checker);
        break;
    }
  }

  return spec;
}

/**
 * Extract PropertySpec from a resolved ts.Type (used for inline kinds
 * where we don't have a type node for the props, but we have the type).
 */
function extractPropertySpecFromType(
  type: ts.Type,
  checker: ts.TypeChecker,
): PropertySpec {
  const spec: PropertySpec = {};

  for (const prop of type.getProperties()) {
    const name = prop.getName();
    if (name === '__ks') continue;

    const propType = checker.getTypeOfSymbol(prop);

    switch (name) {
      case 'pure':
      case 'noIO':
      case 'noImports':
      case 'noMutation':
      case 'noConsole':
      case 'immutable':
      case 'static':
      case 'noSideEffects':
      case 'exhaustive':
      case 'noSiblingDependency':
        spec[name] = true;
        break;
      case 'maxFanOut':
        if (propType.isNumberLiteral()) {
          spec.maxFanOut = propType.value;
        }
        break;
      case 'scope':
        if (propType.isStringLiteral()) {
          spec.scope = propType.value as 'folder' | 'file';
        }
        break;
      case 'noDependency':
      case 'noTransitiveDependency':
        spec[name] = extractStringTuplePairs(propType, checker);
        break;
      case 'noCycles':
        spec.noCycles = extractStringArray(propType, checker);
        break;
    }
  }

  return spec;
}

// ── AST navigation ─────────────────────────────────────────────────────

/**
 * Find the TypeReferenceNode that points to Kind<Base, Props> in a type
 * expression. Follows alias chains and searches intersection types.
 *
 * For `type DomainLayer = Kind<KSDir, { pure: true }>`:
 *   returns the TypeReferenceNode("Kind") with typeArguments
 *
 * For `type MyDomain = DomainLayer`:
 *   follows DomainLayer → returns the Kind<...> reference
 */
function findKindReference(
  typeNode: ts.TypeNode,
  checker: ts.TypeChecker,
): ts.TypeReferenceNode | undefined {
  if (ts.isTypeReferenceNode(typeNode)) {
    // If this reference has type arguments and resolves to a Kind type,
    // it may be the Kind<Base, Props> we're looking for.
    if (typeNode.typeArguments && typeNode.typeArguments.length >= 1) {
      const type = checker.getTypeAtLocation(typeNode);
      if (isKindType(type)) {
        return typeNode;
      }
    }

    // Follow the alias chain: resolve the symbol to its declaration
    const symbol = checker.getSymbolAtLocation(typeNode.typeName);
    if (symbol) {
      const resolved = resolveSymbol(symbol, checker);
      const decls = resolved.getDeclarations();
      if (decls) {
        for (const decl of decls) {
          if (ts.isTypeAliasDeclaration(decl)) {
            return findKindReference(decl.type, checker);
          }
        }
      }
    }
  }

  // Intersection type: Kind<Base, Props> = Base & { __ks?: true }
  if (ts.isIntersectionTypeNode(typeNode)) {
    for (const member of typeNode.types) {
      const ref = findKindReference(member, checker);
      if (ref) return ref;
    }
  }

  return undefined;
}

/**
 * Extract the base type and PropertySpec from a Kind type alias declaration.
 * Uses findKindReference to locate the Kind<Base, Props> in the AST,
 * then reads typeArguments[0] (base) and typeArguments[1] (props).
 */
function extractKindTypeArguments(
  decl: ts.TypeAliasDeclaration,
  checker: ts.TypeChecker,
): { baseType: ts.Type; properties: PropertySpec } {
  const kindRef = findKindReference(decl.type, checker);

  if (!kindRef || !kindRef.typeArguments) {
    // No Kind<...> found — return the resolved type with empty properties
    return { baseType: checker.getTypeAtLocation(decl.type), properties: {} };
  }

  // typeArguments[0] = Base type
  const baseType = checker.getTypeAtLocation(kindRef.typeArguments[0]);

  // typeArguments[1] = PropertySpec (may be absent for Kind<Base> with no props)
  const properties = kindRef.typeArguments[1]
    ? extractPropertySpecFromNode(kindRef.typeArguments[1], checker)
    : {};

  return { baseType, properties };
}

// ── Step 1 & 2: Find Kind definitions ──────────────────────────────────

interface KindDefInfo {
  baseType: ts.Type;
  properties: PropertySpec;
}

/**
 * Walk all type alias declarations across all source files. For each one,
 * check if the declared type has the __ks marker. If so, extract its
 * base type and PropertySpec.
 */
function findKindDefinitions(
  program: ts.Program,
  checker: ts.TypeChecker,
): Map<ts.Symbol, KindDefInfo> {
  const kindDefs = new Map<ts.Symbol, KindDefInfo>();

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;

    for (const stmt of sourceFile.statements) {
      if (!ts.isTypeAliasDeclaration(stmt)) continue;

      const symbol = checker.getSymbolAtLocation(stmt.name);
      if (!symbol) continue;

      const type = checker.getDeclaredTypeOfSymbol(symbol);
      if (!isKindType(type)) continue;

      // This is a Kind definition — extract its base type and properties
      const { baseType, properties } = extractKindTypeArguments(stmt, checker);
      kindDefs.set(symbol, { baseType, properties });
    }
  }

  return kindDefs;
}

// ── Step 3: Find kind-annotated values ─────────────────────────────────

interface KindValueInfo {
  valueKind: 'function' | 'file' | 'directory' | 'composite';
  path?: string;
  declaration: ts.VariableDeclaration;
}

/**
 * Analyze a variable declaration's initializer to determine what kind
 * of value it is and extract any filesystem path.
 */
function analyzeValueExpression(decl: ts.VariableDeclaration): KindValueInfo {
  const init = decl.initializer;

  // ks.file('./path') or ks.dir('./path')
  if (init && ts.isCallExpression(init)) {
    const expr = init.expression;
    if (ts.isPropertyAccessExpression(expr)) {
      const obj = expr.expression;
      const method = expr.name.text;

      if (ts.isIdentifier(obj) && obj.text === 'ks') {
        const pathArg = init.arguments[0];
        const path = pathArg && ts.isStringLiteral(pathArg) ? pathArg.text : undefined;

        if (method === 'file') return { valueKind: 'file', path, declaration: decl };
        if (method === 'dir') return { valueKind: 'directory', path, declaration: decl };
      }
    }
  }

  // Object literal — composite kind
  if (init && ts.isObjectLiteralExpression(init)) {
    return { valueKind: 'composite', declaration: decl };
  }

  // Function expression or arrow function
  if (init && (ts.isFunctionExpression(init) || ts.isArrowFunction(init))) {
    return { valueKind: 'function', declaration: decl };
  }

  // Default: treat as function (identifier referencing a function, etc.)
  return { valueKind: 'function', declaration: decl };
}

/**
 * Walk all variable declarations across all source files. For each one
 * with a type annotation, resolve the annotation and check if it's a
 * Kind type. If so, analyze the value expression.
 */
function findKindAnnotatedValues(
  program: ts.Program,
  checker: ts.TypeChecker,
): Map<ts.Symbol, KindValueInfo> {
  const values = new Map<ts.Symbol, KindValueInfo>();

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;

    for (const stmt of sourceFile.statements) {
      if (!ts.isVariableStatement(stmt)) continue;

      for (const decl of stmt.declarationList.declarations) {
        if (!decl.type) continue; // No type annotation

        // Resolve the type annotation
        const annotationType = checker.getTypeAtLocation(decl.type);
        if (!isKindType(annotationType)) continue;

        // This value is annotated with a Kind type
        const symbol = checker.getSymbolAtLocation(decl.name);
        if (!symbol) continue;

        // Determine value kind and extract path
        const valueInfo = analyzeValueExpression(decl);
        values.set(symbol, valueInfo);
      }
    }
  }

  return values;
}

// ── Composite member resolution ────────────────────────────────────────

/**
 * Find which Kind definition a type annotation refers to.
 * Resolves the annotation's symbol through imports/aliases and checks kindDefs.
 *
 * When the type annotation has type arguments (e.g., Kind<KSDir, { pure: true }>),
 * this is an inline/specialized usage — return undefined so the caller extracts
 * the PropertySpec directly from the type arguments.
 */
function findKindDefinitionForAnnotation(
  typeNode: ts.TypeNode,
  checker: ts.TypeChecker,
  kindDefs: Map<ts.Symbol, KindDefInfo>,
): ts.Symbol | undefined {
  if (ts.isTypeReferenceNode(typeNode)) {
    // If the reference has type arguments, it's an inline/specialized usage
    // (e.g., Kind<KSDir, { pure: true }>). Don't match to kindDefs — the
    // caller should extract properties from the type arguments instead.
    if (typeNode.typeArguments && typeNode.typeArguments.length > 0) {
      return undefined;
    }

    const symbol = checker.getSymbolAtLocation(typeNode.typeName);
    if (symbol) {
      const resolved = resolveSymbol(symbol, checker);
      if (kindDefs.has(resolved)) return resolved;
    }
  }
  return undefined;
}

/**
 * For a composite Kind definition, extract member KindSymbols from the
 * base type's properties. Each property whose type is itself a Kind
 * becomes a member.
 */
function extractDefinitionMembers(
  baseType: ts.Type,
  checker: ts.TypeChecker,
  kindDefs: Map<ts.Symbol, KindDefInfo>,
  table: KindSymbolTable,
): Map<string, KindSymbol> | undefined {
  if (!(baseType.flags & ts.TypeFlags.Object)) return undefined;

  const members = new Map<string, KindSymbol>();

  for (const prop of baseType.getProperties()) {
    const propType = checker.getTypeOfSymbol(prop);
    if (!isKindType(propType)) continue;

    // Find the Kind definition for this member's type.
    // The property type's aliasSymbol should point to the Kind definition.
    const aliasSymbol = propType.aliasSymbol;
    const defSymbol = aliasSymbol ? resolveSymbol(aliasSymbol, checker) : undefined;

    let memberProperties: PropertySpec = {};
    let memberBaseType = propType;

    if (defSymbol && kindDefs.has(defSymbol)) {
      const def = kindDefs.get(defSymbol)!;
      memberProperties = def.properties;
      memberBaseType = def.baseType;
    }

    // Also check table for the definition KindSymbol
    const kindDefinition = defSymbol ? table.get(defSymbol) : undefined;

    members.set(prop.getName(), {
      tsSymbol: prop,
      name: prop.getName(),
      role: 'definition',
      declaredProperties: memberProperties,
      baseType: memberBaseType,
      kindDefinition,
      valueKind: 'composite',
    });
  }

  return members.size > 0 ? members : undefined;
}

/**
 * For a composite value (object literal), resolve each property to its
 * member KindSymbol with path and valueKind from the property's value.
 */
function extractValueMembers(
  declaration: ts.VariableDeclaration,
  defMembers: Map<string, KindSymbol> | undefined,
  checker: ts.TypeChecker,
): Map<string, KindSymbol> | undefined {
  const init = declaration.initializer;
  if (!init || !ts.isObjectLiteralExpression(init)) return undefined;

  const members = new Map<string, KindSymbol>();

  for (const prop of init.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;

    const name = prop.name && ts.isIdentifier(prop.name)
      ? prop.name.text
      : undefined;
    if (!name) continue;

    // Get member definition for this name
    const defMember = defMembers?.get(name);

    // Analyze the property's value expression
    const valueInit = prop.initializer;
    let valueKind: KindSymbol['valueKind'] = 'function';
    let path: string | undefined;

    if (valueInit && ts.isCallExpression(valueInit)) {
      const expr = valueInit.expression;
      if (ts.isPropertyAccessExpression(expr)) {
        const obj = expr.expression;
        const method = expr.name.text;
        if (ts.isIdentifier(obj) && obj.text === 'ks') {
          const pathArg = valueInit.arguments[0];
          path = pathArg && ts.isStringLiteral(pathArg) ? pathArg.text : undefined;
          if (method === 'file') valueKind = 'file';
          else if (method === 'dir') valueKind = 'directory';
        }
      }
    } else if (valueInit && ts.isObjectLiteralExpression(valueInit)) {
      valueKind = 'composite';
    } else if (valueInit && (ts.isFunctionExpression(valueInit) || ts.isArrowFunction(valueInit))) {
      valueKind = 'function';
    }

    const propSymbol = checker.getSymbolAtLocation(prop.name);

    members.set(name, {
      tsSymbol: propSymbol ?? defMember?.tsSymbol ?? ({} as ts.Symbol),
      name,
      role: 'value',
      declaredProperties: defMember?.declaredProperties ?? {},
      baseType: defMember?.baseType ?? checker.getTypeAtLocation(prop),
      kindDefinition: defMember,
      path,
      valueKind,
    });
  }

  return members.size > 0 ? members : undefined;
}

// ── Step 4: Main entry point ───────────────────────────────────────────

/**
 * Run the KindScript binder on a TypeScript program.
 *
 * Identifies Kind type definitions and kind-annotated values, extracts
 * their PropertySpecs, and builds the KindSymbolTable.
 */
export function ksBind(tsProgram: ts.Program): KindSymbolTable {
  const checker = tsProgram.getTypeChecker();
  const table: KindSymbolTable = new WeakMap();

  // Step 1 & 2: Find Kind definitions and extract PropertySpecs
  const kindDefs = findKindDefinitions(tsProgram, checker);

  // First pass: create definition entries (without members, since
  // member resolution needs definitions to already be in the table)
  for (const [symbol, { baseType, properties }] of kindDefs) {
    table.set(symbol, {
      tsSymbol: symbol,
      name: symbol.getName(),
      role: 'definition',
      declaredProperties: properties,
      baseType,
      valueKind: 'composite',
    });
  }

  // Second pass: resolve composite members now that all definitions
  // are in the table
  for (const [symbol, { baseType }] of kindDefs) {
    const members = extractDefinitionMembers(baseType, checker, kindDefs, table);
    if (members) {
      const entry = table.get(symbol)!;
      entry.members = members;
    }
  }

  // Step 3: Find kind-annotated values
  const values = findKindAnnotatedValues(tsProgram, checker);

  for (const [symbol, valueInfo] of values) {
    // Resolve the Kind definition this value is annotated with
    const defSymbol = findKindDefinitionForAnnotation(
      valueInfo.declaration.type!,
      checker,
      kindDefs,
    );

    let declaredProperties: PropertySpec;
    let kindDefinition: KindSymbol | undefined;
    let baseType: ts.Type;

    if (defSymbol) {
      // Named Kind: use the definition's properties
      declaredProperties = kindDefs.get(defSymbol)!.properties;
      kindDefinition = table.get(defSymbol);
      baseType = kindDefs.get(defSymbol)!.baseType;
    } else {
      // Inline Kind or unknown: extract PropertySpec from the type annotation
      const kindRef = findKindReference(valueInfo.declaration.type!, checker);
      declaredProperties = kindRef?.typeArguments?.[1]
        ? extractPropertySpecFromNode(kindRef.typeArguments[1], checker)
        : {};
      baseType = checker.getTypeAtLocation(valueInfo.declaration.type!);
    }

    // Resolve composite value members
    const defMembers = kindDefinition?.members;
    const valueMembers = valueInfo.valueKind === 'composite'
      ? extractValueMembers(valueInfo.declaration, defMembers, checker)
      : undefined;

    table.set(symbol, {
      tsSymbol: symbol,
      name: symbol.getName(),
      role: 'value',
      declaredProperties,
      baseType,
      kindDefinition,
      path: valueInfo.path,
      valueKind: valueInfo.valueKind,
      members: valueMembers,
    });
  }

  return table;
}

// ── Exported utilities (for tests and checker) ─────────────────────────

export { isKindType };
