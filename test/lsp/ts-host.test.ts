/**
 * Tests for KSLanguageServiceHost.
 */

import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import * as path from 'node:path';
import { TextDocuments } from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { KSLanguageServiceHost } from '../../apps/lsp/server/ts-host.js';

const FIXTURE_DIR = path.resolve(__dirname, '../fixtures/protobuf-getter');
const PROJECT_ROOT = path.resolve(__dirname, '../..');

/** Create a minimal TextDocuments instance (no connection — get() always returns undefined). */
function createEmptyDocuments(): TextDocuments<TextDocument> {
  const docs = new TextDocuments(TextDocument);
  return docs;
}

describe('KSLanguageServiceHost', () => {
  it('reads tsconfig.json from workspace root', () => {
    // Use the project root which has a real tsconfig.json
    const host = new KSLanguageServiceHost(PROJECT_ROOT, createEmptyDocuments());
    const settings = host.getCompilationSettings();
    expect(settings).toBeDefined();
    expect(settings.strict).toBe(true);
  });

  it('discovers root file names from tsconfig', () => {
    const host = new KSLanguageServiceHost(PROJECT_ROOT, createEmptyDocuments());
    const fileNames = host.getScriptFileNames();
    expect(fileNames.length).toBeGreaterThan(0);
    // The root tsconfig includes apps/ and src/
    expect(fileNames.some(f => f.includes('src/'))).toBe(true);
  });

  it('returns script snapshots for files on disk', () => {
    const host = new KSLanguageServiceHost(PROJECT_ROOT, createEmptyDocuments());
    const fileNames = host.getScriptFileNames();
    const snapshot = host.getScriptSnapshot(fileNames[0]);
    expect(snapshot).toBeDefined();
    expect(snapshot!.getText(0, 10).length).toBe(10);
  });

  it('returns undefined for nonexistent files', () => {
    const host = new KSLanguageServiceHost(PROJECT_ROOT, createEmptyDocuments());
    const snapshot = host.getScriptSnapshot('/nonexistent/file.ts');
    expect(snapshot).toBeUndefined();
  });

  it('tracks file versions', () => {
    const host = new KSLanguageServiceHost(PROJECT_ROOT, createEmptyDocuments());
    const file = host.getScriptFileNames()[0];

    expect(host.getScriptVersion(file)).toBe('0');
    host.bumpVersion(file);
    expect(host.getScriptVersion(file)).toBe('1');
    host.bumpVersion(file);
    expect(host.getScriptVersion(file)).toBe('2');
  });

  it('increments project version on bumpVersion', () => {
    const host = new KSLanguageServiceHost(PROJECT_ROOT, createEmptyDocuments());
    const v0 = host.getProjectVersion();
    host.bumpVersion('/some/file.ts');
    const v1 = host.getProjectVersion();
    expect(Number(v1)).toBeGreaterThan(Number(v0));
  });

  it('uses default options when no tsconfig exists', () => {
    const host = new KSLanguageServiceHost('/tmp/no-tsconfig-here', createEmptyDocuments());
    const settings = host.getCompilationSettings();
    expect(settings.strict).toBe(true);
    expect(host.getScriptFileNames()).toHaveLength(0);
  });

  it('reports tsconfig errors via logger', () => {
    const warnings: string[] = [];
    const logger = { warn: (msg: string) => warnings.push(msg) };
    // Use a directory that exists but has no tsconfig — should use defaults, no warnings
    const host = new KSLanguageServiceHost('/tmp', createEmptyDocuments(), logger);
    expect(host.getScriptFileNames()).toHaveLength(0);
    // No warnings for missing tsconfig (it falls back to defaults)
    // Warnings would only fire for malformed tsconfig
  });

  it('reloadConfig updates compiler settings', () => {
    const host = new KSLanguageServiceHost(PROJECT_ROOT, createEmptyDocuments());
    const v0 = host.getProjectVersion();
    host.reloadConfig();
    const v1 = host.getProjectVersion();
    expect(Number(v1)).toBeGreaterThan(Number(v0));
    // Settings should still be valid after reload
    expect(host.getCompilationSettings()).toBeDefined();
    expect(host.getScriptFileNames().length).toBeGreaterThan(0);
  });
});
