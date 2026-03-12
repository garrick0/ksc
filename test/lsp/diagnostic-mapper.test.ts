/**
 * Tests for the diagnostic mapper module.
 *
 * Verifies KS Diagnostic → LSP Diagnostic conversion.
 */

import { describe, it, expect } from 'vitest';
import { DiagnosticSeverity } from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { mapDiagnostics, textDocumentFromFile } from '../../apps/lsp/server/diagnostic-mapper.js';
import * as path from 'node:path';
import type { Diagnostic as KSDiagnostic } from '../../src/adapters/analysis/spec/ts-kind-checking/types.js';

function makeTextDocument(content: string): TextDocument {
  return TextDocument.create('file:///test.ts', 'typescript', 0, content);
}

function makeKSDiag(overrides: Partial<KSDiagnostic> = {}): KSDiagnostic {
  return {
    node: {} as KSDiagnostic['node'],
    message: 'Direct field access on protobuf type: use getter instead',
    kindName: 'Pure',
    property: 'protobuf-getter',
    pos: 10,
    end: 20,
    fileName: '/test.ts',
    ...overrides,
  };
}

describe('mapDiagnostics', () => {
  const content = 'const x = user.name;\nconst y = 123;\n';
  const doc = makeTextDocument(content);

  it('maps pos/end to LSP range via positionAt', () => {
    const diag = makeKSDiag({ pos: 10, end: 19 });
    const [lsp] = mapDiagnostics([diag], doc);

    expect(lsp.range.start.line).toBe(0);
    expect(lsp.range.start.character).toBe(10);
    expect(lsp.range.end.line).toBe(0);
    expect(lsp.range.end.character).toBe(19);
  });

  it('sets source to "kindscript"', () => {
    const [lsp] = mapDiagnostics([makeKSDiag()], doc);
    expect(lsp.source).toBe('kindscript');
  });

  it('sets code to the property name', () => {
    const [lsp] = mapDiagnostics([makeKSDiag({ property: 'protobuf-getter' })], doc);
    expect(lsp.code).toBe('protobuf-getter');
  });

  it('copies message verbatim', () => {
    const msg = 'Direct field access on protobuf type';
    const [lsp] = mapDiagnostics([makeKSDiag({ message: msg })], doc);
    expect(lsp.message).toBe(msg);
  });

  it('defaults to Warning severity', () => {
    const [lsp] = mapDiagnostics([makeKSDiag()], doc);
    expect(lsp.severity).toBe(DiagnosticSeverity.Warning);
  });

  it('respects severity setting', () => {
    const [lsp] = mapDiagnostics([makeKSDiag()], doc, 'error');
    expect(lsp.severity).toBe(DiagnosticSeverity.Error);
  });

  it('maps multiple diagnostics', () => {
    const diags = [
      makeKSDiag({ pos: 0, end: 5 }),
      makeKSDiag({ pos: 10, end: 15 }),
    ];
    const lspDiags = mapDiagnostics(diags, doc);
    expect(lspDiags).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    const result = mapDiagnostics([], doc);
    expect(result).toHaveLength(0);
  });
});

describe('textDocumentFromFile', () => {
  it('creates a TextDocument from a real file', () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/protobuf-getter/src/person_pb.ts');
    const doc = textDocumentFromFile(fixturePath);
    expect(doc).toBeDefined();
    expect(doc!.getText().length).toBeGreaterThan(0);
    expect(doc!.uri).toContain('person_pb.ts');
  });

  it('returns undefined for nonexistent file', () => {
    const doc = textDocumentFromFile('/nonexistent/path/file.ts');
    expect(doc).toBeUndefined();
  });
});
