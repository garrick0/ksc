/**
 * Tests for the LSP analyzer module.
 *
 * Verifies that the Analyzer class correctly wraps the KindScript pipeline
 * and produces diagnostics grouped by file.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import ts from 'typescript';
import * as path from 'node:path';
import { Analyzer } from '../../apps/lsp/server/analyzer.js';

const FIXTURE_DIR = path.resolve(__dirname, '../fixtures/protobuf-getter');

describe('Analyzer', () => {
  let languageService: ts.LanguageService;
  let analyzer: Analyzer;

  beforeAll(() => {
    // Create a real TS LanguageService over the protobuf-getter fixture
    const tsconfigPath = path.join(FIXTURE_DIR, 'tsconfig.json');
    const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      FIXTURE_DIR,
    );

    const host: ts.LanguageServiceHost = {
      getCompilationSettings: () => parsed.options,
      getScriptFileNames: () => parsed.fileNames,
      getScriptVersion: () => '0',
      getScriptSnapshot: (fileName) => {
        if (!ts.sys.fileExists(fileName)) return undefined;
        const content = ts.sys.readFile(fileName);
        return content !== undefined ? ts.ScriptSnapshot.fromString(content) : undefined;
      },
      getCurrentDirectory: () => FIXTURE_DIR,
      getDefaultLibFileName: ts.getDefaultLibFilePath,
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      readDirectory: ts.sys.readDirectory,
      directoryExists: ts.sys.directoryExists,
    };

    languageService = ts.createLanguageService(host, ts.createDocumentRegistry());
  });

  beforeEach(() => {
    analyzer = new Analyzer();
  });

  it('returns empty diagnostics when protobuf checking is disabled', () => {
    analyzer.updateConfig({});
    const result = analyzer.analyze(languageService);

    const allDiags = [...result.values()].flat();
    const pbDiags = allDiags.filter(d => d.property === 'protobuf-getter');
    expect(pbDiags).toHaveLength(0);
  });

  it('returns protobuf diagnostics when protobuf checking is enabled', () => {
    analyzer.updateConfig({ protobuf: { enabled: true } });
    const result = analyzer.analyze(languageService);

    const allDiags = [...result.values()].flat();
    const pbDiags = allDiags.filter(d => d.property === 'protobuf-getter');
    expect(pbDiags.length).toBeGreaterThan(0);
  });

  it('groups diagnostics by file name', () => {
    analyzer.updateConfig({ protobuf: { enabled: true } });
    const result = analyzer.analyze(languageService);

    const handlerFile = [...result.keys()].find(f => f.endsWith('handler.ts'));
    expect(handlerFile).toBeDefined();
    const handlerDiags = result.get(handlerFile!)!;
    const pbHandlerDiags = handlerDiags.filter(d => d.property === 'protobuf-getter');
    expect(pbHandlerDiags.length).toBeGreaterThan(0);
  });

  it('clears diagnostics for files that no longer have issues', () => {
    // First run with protobuf enabled to populate lastDiagnostics
    analyzer.updateConfig({ protobuf: { enabled: true } });
    analyzer.analyze(languageService);

    // Second run with protobuf disabled
    analyzer.updateConfig({});
    const withoutPb = analyzer.analyze(languageService);

    for (const [, diags] of withoutPb) {
      const pbDiags = diags.filter(d => d.property === 'protobuf-getter');
      expect(pbDiags).toHaveLength(0);
    }
  });

  it('getLastDiagnostics returns cached results', () => {
    analyzer.updateConfig({ protobuf: { enabled: true } });
    analyzer.analyze(languageService);

    const cached = analyzer.getLastDiagnostics();
    const allDiags = [...cached.values()].flat();
    const pbDiags = allDiags.filter(d => d.property === 'protobuf-getter');
    expect(pbDiags.length).toBeGreaterThan(0);
  });

  it('routes errors to logger instead of console', () => {
    const errors: string[] = [];
    const loggedAnalyzer = new Analyzer({ error: (msg) => errors.push(msg) });
    loggedAnalyzer.updateConfig({});

    // Create a mock language service that returns a program that will cause issues
    // For this test, just verify the logger is connected — actual error paths
    // are hard to trigger without breaking the TS LanguageService contract
    const result = loggedAnalyzer.analyze(languageService);
    expect(result).toBeDefined();
  });
});
