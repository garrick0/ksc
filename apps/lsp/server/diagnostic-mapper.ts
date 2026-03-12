/**
 * Diagnostic mapper — converts KindScript diagnostics to LSP diagnostics.
 *
 * Pure function module — no state. Uses TextDocument.positionAt() for
 * offset → line/character conversion.
 */

import {
  Diagnostic as LSPDiagnostic,
  DiagnosticSeverity,
} from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { Diagnostic as KSDiagnostic } from '../../../src/adapters/analysis/spec/ts-kind-checking/types.js';
import { filePathToUri } from './uri.js';
import * as fs from 'node:fs';

/** Severity string from extension settings → LSP severity. */
const SEVERITY_MAP: Record<string, DiagnosticSeverity> = {
  error: DiagnosticSeverity.Error,
  warning: DiagnosticSeverity.Warning,
  information: DiagnosticSeverity.Information,
  hint: DiagnosticSeverity.Hint,
};

/**
 * Convert KindScript diagnostics for a single file into LSP diagnostics.
 *
 * @param ksDiags   KindScript diagnostics for this file
 * @param document  The TextDocument for offset→position conversion (open doc or from disk)
 * @param severity  Severity string from extension settings (default: "warning")
 */
export function mapDiagnostics(
  ksDiags: KSDiagnostic[],
  document: TextDocument,
  severity: string = 'warning',
): LSPDiagnostic[] {
  const lspSeverity = SEVERITY_MAP[severity] ?? DiagnosticSeverity.Warning;

  return ksDiags.map(kd => {
    // Extract field name from message (e.g., "'.name'") and attach as data
    // so code actions don't need to re-parse the message text.
    const fieldMatch = kd.message.match(/'\.(\w+)'/);
    const data = fieldMatch ? { fieldName: fieldMatch[1] } : undefined;

    return {
      range: {
        start: document.positionAt(kd.pos),
        end: document.positionAt(kd.end),
      },
      severity: lspSeverity,
      code: kd.property,
      source: 'kindscript',
      message: kd.message,
      data,
    };
  });
}

/**
 * Create a TextDocument from a file path (for files not currently open).
 * Returns undefined if the file cannot be read.
 */
export function textDocumentFromFile(filePath: string): TextDocument | undefined {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const uri = filePathToUri(filePath);
    return TextDocument.create(uri, 'typescript', 0, content);
  } catch {
    return undefined;
  }
}
