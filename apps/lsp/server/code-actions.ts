/**
 * Quick-fix code action provider — protobuf getter/setter rewrites.
 *
 * Transforms direct protobuf field access into getter/setter calls:
 *   expr.field       → expr.getField()      (read)
 *   expr.field = val → expr.setField(val)    (write)
 *   expr['field']    → expr.getField()       (element read)
 */

import {
  CodeAction,
  CodeActionKind,
  TextEdit,
  type CodeActionParams,
  type Diagnostic as LSPDiagnostic,
} from 'vscode-languageserver/node.js';
import type { TextDocument } from 'vscode-languageserver-textdocument';

/** Capitalize first letter: "name" → "Name". */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Extract the field name from a diagnostic. Prefers structured data, falls back to message regex. */
function extractFieldName(diag: LSPDiagnostic): string | undefined {
  // Prefer structured data attached by the diagnostic mapper
  const data = diag.data as { fieldName?: string } | undefined;
  if (data?.fieldName) return data.fieldName;
  // Fallback: parse from message (e.g., "'.name'")
  const match = diag.message.match(/'\.(\w+)'/);
  return match?.[1];
}

/**
 * Generate code actions for KindScript diagnostics in the given range.
 *
 * Only generates fixes for protobuf-getter violations.
 */
export function getCodeActions(
  params: CodeActionParams,
  document: TextDocument,
): CodeAction[] {
  const actions: CodeAction[] = [];

  for (const diag of params.context.diagnostics) {
    if (diag.source !== 'kindscript' || diag.code !== 'protobuf-getter') {
      continue;
    }

    const fieldName = extractFieldName(diag);
    if (!fieldName) continue;

    const sourceText = document.getText(diag.range);
    const lineText = document.getText({
      start: { line: diag.range.start.line, character: 0 },
      end: { line: diag.range.start.line + 1, character: 0 },
    });

    // Determine if this is a write (assignment) pattern
    const isWrite = detectWritePattern(lineText, diag);

    if (isWrite) {
      const action = createSetterAction(diag, document, fieldName, lineText);
      if (action) actions.push(action);
    } else {
      const action = createGetterAction(diag, document, fieldName, sourceText);
      if (action) actions.push(action);
    }
  }

  return actions;
}

/** Detect if the diagnostic covers a write (assignment) pattern. */
function detectWritePattern(
  lineText: string,
  diag: LSPDiagnostic,
): boolean {
  // Check if the line contains an assignment after the diagnostic range
  const afterDiag = lineText.slice(diag.range.end.character);
  return /^\s*=\s*[^=]/.test(afterDiag);
}

/** Create a getter quick-fix: expr.field → expr.getField() or expr['field'] → expr.getField(). */
function createGetterAction(
  diag: LSPDiagnostic,
  document: TextDocument,
  fieldName: string,
  sourceText: string,
): CodeAction | undefined {
  const getterName = `get${capitalize(fieldName)}()`;

  // Determine what to replace:
  // For property access (expr.field): replace just ".field" with ".getField()"
  // For element access (expr['field']): the diagnostic covers the element access expression
  let newText: string;

  if (sourceText.includes('[')) {
    // Element access pattern — diagnostic covers "expr['field']" or "expr[field]"
    // We need to find the bracket part and replace it
    const bracketIdx = sourceText.indexOf('[');
    const prefix = sourceText.slice(0, bracketIdx);
    newText = `${prefix}.${getterName}`;
  } else if (sourceText.includes('.')) {
    // Property access — diagnostic covers "expr.field"
    const dotIdx = sourceText.lastIndexOf('.');
    const prefix = sourceText.slice(0, dotIdx);
    newText = `${prefix}.${getterName}`;
  } else {
    return undefined;
  }

  return {
    title: `Use ${getterName} instead`,
    kind: CodeActionKind.QuickFix,
    isPreferred: true,
    diagnostics: [diag],
    edit: {
      changes: {
        [document.uri]: [TextEdit.replace(diag.range, newText)],
      },
    },
  };
}

/** Create a setter quick-fix: expr.field = value → expr.setField(value). */
function createSetterAction(
  diag: LSPDiagnostic,
  document: TextDocument,
  fieldName: string,
  lineText: string,
): CodeAction | undefined {
  const setterName = `set${capitalize(fieldName)}`;

  // Parse the full assignment: "  expr.field = value;"
  // We need to replace from the diagnostic start through the end of the assignment
  const diagSourceText = document.getText(diag.range);

  // Find the expression before the field
  let exprPrefix: string;
  if (diagSourceText.includes('.')) {
    const dotIdx = diagSourceText.lastIndexOf('.');
    exprPrefix = diagSourceText.slice(0, dotIdx);
  } else {
    return undefined;
  }

  // Extract the value from the assignment
  const afterDiag = lineText.slice(diag.range.end.character);
  const assignMatch = afterDiag.match(/^\s*=\s*(.+?)\s*;?\s*$/);
  if (!assignMatch) return undefined;

  const value = assignMatch[1].trim();
  const newText = `${exprPrefix}.${setterName}(${value})`;

  // The replacement range covers from diagnostic start to end of assignment (before newline/semicolon)
  const assignmentEndChar = diag.range.end.character + (assignMatch[0].endsWith(';')
    ? assignMatch[0].length
    : assignMatch[0].trimEnd().length);

  return {
    title: `Use ${setterName}() instead`,
    kind: CodeActionKind.QuickFix,
    isPreferred: true,
    diagnostics: [diag],
    edit: {
      changes: {
        [document.uri]: [
          TextEdit.replace(
            {
              start: diag.range.start,
              end: { line: diag.range.start.line, character: assignmentEndChar },
            },
            newText,
          ),
        ],
      },
    },
  };
}
