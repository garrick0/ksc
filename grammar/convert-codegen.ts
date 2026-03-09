/**
 * Shared per-kind converter code generation helpers.
 *
 * Used by spec-owned convert generators (e.g. specs/ts-ast/grammar/convert-generator.ts)
 * to emit the data-driven register() calls for each node kind. Specs provide the
 * infrastructure (imports, tree walking, dispatch) and call these helpers for the
 * per-kind converter bodies.
 */

import type { NodeEntry, SumTypeEntry, FieldDesc } from './builder.js';

// ── Types ────────────────────────────────────────────────────────────

export interface ConvertGeneratorInput {
  nodes: ReadonlyMap<string, NodeEntry>;
  sumTypes: ReadonlyMap<string, SumTypeEntry>;
  fieldExtractors: Record<string, Record<string, string>>;
  skipConvert: ReadonlySet<string>;
  syntaxKindOverrides: Record<string, number>;
  jsDocMembers: ReadonlySet<string>;
}

export interface ConverterEntry {
  kind: string;
  fields: Array<{ name: string; expr: string }>;
  isLeaf: boolean;
}

// ── Field expression resolution ──────────────────────────────────────

export function getConvertFieldExpr(
  kind: string,
  fname: string,
  field: FieldDesc,
  fieldExtractors: Record<string, Record<string, string>>,
  jsDocMembers: ReadonlySet<string>,
): string {
  // Explicit override
  const override = fieldExtractors[kind]?.[fname];
  if (override) return override;

  // Auto-detect: literal value/linkText → n.text
  if ((fname === 'value' || fname === 'linkText') && field.tag === 'prop' && field.propType === 'string') {
    return 'n.text ?? ""';
  }

  // Auto-detect: JSDoc comment prop (TS .comment can be string | NodeArray)
  if (fname === 'comment' && field.tag === 'prop' && field.propType === 'string' && jsDocMembers.has(kind)) {
    return 'extractJSDocComment(n)';
  }

  // Default extraction by field tag
  switch (field.tag) {
    case 'child':    return `findChild(children, n.${fname})!`;
    case 'optChild': return `findChild(children, n.${fname})`;
    case 'list':     return `findChildrenOf(children, n.${fname})`;
    case 'prop': {
      if (field.propType === 'boolean') return `!!n.${fname}`;
      if (field.propType === 'string') return `n.${fname} ?? ""`;
      if (field.propType === 'readonly number[]') return `n.${fname} ?? []`;
      return `n.${fname}`;
    }
  }
}

// ── Converter entry builder ──────────────────────────────────────────

/**
 * Build per-kind converter entries from grammar spec data.
 * Returns one entry per node kind (minus skipConvert), with pre-computed
 * field extraction expressions.
 */
export function buildConverterEntries(input: ConvertGeneratorInput): ConverterEntry[] {
  const entries: ConverterEntry[] = [];
  for (const [kind, nodeEntry] of input.nodes) {
    if (input.skipConvert.has(kind)) continue;
    const fieldEntries = Object.entries(nodeEntry.fields);
    entries.push({
      kind,
      fields: fieldEntries.map(([fname, field]) => ({
        name: fname,
        expr: getConvertFieldExpr(kind, fname, field, input.fieldExtractors, input.jsDocMembers),
      })),
      isLeaf: fieldEntries.length === 0,
    });
  }
  return entries;
}

// ── Code emission ────────────────────────────────────────────────────

/**
 * Emit register() calls as lines of TypeScript source code.
 *
 * @param entries - converter entries from buildConverterEntries()
 * @param syntaxKindFn - maps kind string to the registration expression
 *   (e.g. "ts.SyntaxKind.Identifier" or "42 as ts.SyntaxKind")
 */
export function emitConverterRegistrations(
  entries: ConverterEntry[],
  syntaxKindFn: (kind: string) => string,
): string[] {
  const L: string[] = [];
  for (const entry of entries) {
    const kindExpr = syntaxKindFn(entry.kind);

    if (entry.isLeaf) {
      L.push(`register(${kindExpr}, (node, sf, children, pos, end, text) => ({`);
      L.push(`  kind: '${entry.kind}', pos, end, text, children,`);
      L.push(`} as KS.KSNode));`);
    } else {
      L.push(`register(${kindExpr}, (node, sf, children, pos, end, text) => {`);
      L.push(`  const n = node as any;`);
      L.push(`  return {`);
      L.push(`    kind: '${entry.kind}',`);
      for (const f of entry.fields) {
        L.push(`    ${f.name}: ${f.expr},`);
      }
      L.push(`    pos, end, text, children,`);
      L.push(`  } as KS.KSNode;`);
      L.push(`});`);
    }
    L.push(``);
  }
  return L;
}

// ── Expression validation ─────────────────────────────────────────────

export interface ExprValidationDiagnostic {
  kind: string;
  field: string;
  expr: string;
  unknownRef: string;
}

/** Built-in names available in the generated converter scope (from the skeleton). */
const BUILTIN_NAMES = new Set([
  'findChild', 'findChildrenOf', 'n', 'node', 'sf', 'children', 'pos', 'end', 'text', 'ts', '_ctx',
]);

/**
 * Validate that function-call-like references in field extractor expressions
 * resolve to known names (helpers, builtins, or infrastructure).
 *
 * Returns diagnostics for unrecognized function references.
 */
export function validateFieldExpressions(
  fieldExtractors: Record<string, Record<string, string>>,
  knownHelpers: ReadonlySet<string>,
): ExprValidationDiagnostic[] {
  const diagnostics: ExprValidationDiagnostic[] = [];
  const fnCallPattern = /\b([a-zA-Z_]\w*)\s*\(/g;

  for (const [kind, fields] of Object.entries(fieldExtractors)) {
    for (const [field, expr] of Object.entries(fields)) {
      let match: RegExpExecArray | null;
      fnCallPattern.lastIndex = 0;
      while ((match = fnCallPattern.exec(expr)) !== null) {
        const name = match[1];
        if (!BUILTIN_NAMES.has(name) && !knownHelpers.has(name)) {
          diagnostics.push({ kind, field, expr, unknownRef: name });
        }
      }
    }
  }

  return diagnostics;
}
