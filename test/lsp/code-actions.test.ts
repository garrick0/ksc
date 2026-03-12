/**
 * Tests for the code actions provider.
 *
 * Verifies that protobuf getter violations produce correct quick-fix code actions.
 */

import { describe, it, expect } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CodeActionKind, type CodeActionParams, type Diagnostic as LSPDiagnostic, DiagnosticSeverity } from 'vscode-languageserver/node.js';
import { getCodeActions } from '../../apps/lsp/server/code-actions.js';

function makeDocument(content: string, uri = 'file:///test.ts'): TextDocument {
  return TextDocument.create(uri, 'typescript', 0, content);
}

function makeDiag(overrides: Partial<LSPDiagnostic> = {}): LSPDiagnostic {
  return {
    range: { start: { line: 0, character: 10 }, end: { line: 0, character: 19 } },
    severity: DiagnosticSeverity.Warning,
    code: 'protobuf-getter',
    source: 'kindscript',
    message: "Direct protobuf field access '.name' on type 'User'",
    ...overrides,
  };
}

function makeParams(document: TextDocument, diagnostics: LSPDiagnostic[]): CodeActionParams {
  return {
    textDocument: { uri: document.uri },
    range: diagnostics[0]?.range ?? { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
    context: { diagnostics },
  };
}

describe('getCodeActions', () => {
  it('generates getter fix for property access read', () => {
    //                0123456789012345678
    const content = 'const x = user.name;\n';
    const doc = makeDocument(content);
    const diag = makeDiag({
      range: { start: { line: 0, character: 10 }, end: { line: 0, character: 19 } },
      message: "Direct protobuf field access '.name' on type 'User'",
    });
    const params = makeParams(doc, [diag]);
    const actions = getCodeActions(params, doc);

    expect(actions.length).toBeGreaterThanOrEqual(1);
    const fix = actions[0];
    expect(fix.title).toContain('getName()');
    expect(fix.kind).toBe(CodeActionKind.QuickFix);
    expect(fix.isPreferred).toBe(true);

    // Check the text edit
    const edits = fix.edit?.changes?.[doc.uri];
    expect(edits).toBeDefined();
    expect(edits![0].newText).toBe('user.getName()');
  });

  it('ignores non-kindscript diagnostics', () => {
    const doc = makeDocument('const x = user.name;\n');
    const diag = makeDiag({ source: 'typescript' });
    const params = makeParams(doc, [diag]);
    const actions = getCodeActions(params, doc);

    expect(actions).toHaveLength(0);
  });

  it('ignores non-protobuf-getter diagnostics', () => {
    const doc = makeDocument('const x = user.name;\n');
    const diag = makeDiag({ code: 'noConsole' });
    const params = makeParams(doc, [diag]);
    const actions = getCodeActions(params, doc);

    expect(actions).toHaveLength(0);
  });

  it('generates setter fix for write pattern', () => {
    //                0123456789012345678901234567890
    const content = 'user.name = "test";\n';
    const doc = makeDocument(content);
    const diag = makeDiag({
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 9 } },
      message: "Direct protobuf field access '.name' on type 'User'",
    });
    const params = makeParams(doc, [diag]);
    const actions = getCodeActions(params, doc);

    expect(actions.length).toBeGreaterThanOrEqual(1);
    const fix = actions[0];
    expect(fix.title).toContain('setName()');
  });

  it('capitalizes field name correctly', () => {
    const content = 'const x = user.email;\n';
    const doc = makeDocument(content);
    const diag = makeDiag({
      range: { start: { line: 0, character: 10 }, end: { line: 0, character: 20 } },
      message: "Direct protobuf field access '.email' on type 'User'",
    });
    const params = makeParams(doc, [diag]);
    const actions = getCodeActions(params, doc);

    expect(actions.length).toBeGreaterThanOrEqual(1);
    expect(actions[0].title).toContain('getEmail()');
  });

  it('generates setter fix with correct TextEdit', () => {
    //  0123456789012345678901234567890
    const content = 'user.name = "test";\n';
    const doc = makeDocument(content);
    const diag = makeDiag({
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 9 } },
      message: "Direct protobuf field access '.name' on type 'User'",
    });
    const params = makeParams(doc, [diag]);
    const actions = getCodeActions(params, doc);

    expect(actions.length).toBeGreaterThanOrEqual(1);
    const fix = actions[0];
    const edits = fix.edit?.changes?.[doc.uri];
    expect(edits).toBeDefined();
    expect(edits![0].newText).toBe('user.setName("test")');
  });

  it('generates getter fix for element access', () => {
    //  01234567890123456789012345678
    const content = "const x = user['name'];\n";
    const doc = makeDocument(content);
    const diag = makeDiag({
      range: { start: { line: 0, character: 10 }, end: { line: 0, character: 22 } },
      message: "Direct protobuf field access '.name' on type 'User'",
    });
    const params = makeParams(doc, [diag]);
    const actions = getCodeActions(params, doc);

    expect(actions.length).toBeGreaterThanOrEqual(1);
    const fix = actions[0];
    expect(fix.title).toContain('getName()');
    const edits = fix.edit?.changes?.[doc.uri];
    expect(edits).toBeDefined();
    expect(edits![0].newText).toBe('user.getName()');
  });

  it('handles multiple diagnostics in one request', () => {
    const content = 'const a = user.name;\nconst b = user.email;\n';
    const doc = makeDocument(content);
    const diag1 = makeDiag({
      range: { start: { line: 0, character: 10 }, end: { line: 0, character: 19 } },
      message: "Direct protobuf field access '.name' on type 'User'",
    });
    const diag2 = makeDiag({
      range: { start: { line: 1, character: 10 }, end: { line: 1, character: 20 } },
      message: "Direct protobuf field access '.email' on type 'User'",
    });
    const params = makeParams(doc, [diag1, diag2]);
    const actions = getCodeActions(params, doc);

    expect(actions.length).toBeGreaterThanOrEqual(2);
  });
});
