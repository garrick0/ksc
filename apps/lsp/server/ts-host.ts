/**
 * TypeScript LanguageServiceHost implementation for the LSP server.
 *
 * Tracks open documents from LSP text document sync and reads non-open
 * files from disk. Provides incremental re-parsing via version tracking
 * and ScriptSnapshot caching.
 */

import ts from 'typescript';
import * as path from 'node:path';
import type { TextDocuments } from 'vscode-languageserver/node.js';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { filePathToUri } from './uri.js';

/** Logger interface so the host can report issues without depending on LSP connection. */
export interface HostLogger {
  warn(message: string): void;
}

const DEFAULT_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.Node16,
  moduleResolution: ts.ModuleResolutionKind.Node16,
  strict: true,
  esModuleInterop: true,
  skipLibCheck: true,
};

/** Parse tsconfig.json safely, returning defaults on error. */
function parseTsConfig(
  tsconfigPath: string,
  logger?: HostLogger,
): { options: ts.CompilerOptions; fileNames: string[] } {
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    const msg = ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n');
    logger?.warn(`[kindscript] Failed to read tsconfig.json: ${msg}`);
    return { options: { ...DEFAULT_OPTIONS }, fileNames: [] };
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(tsconfigPath),
  );

  if (parsed.errors.length > 0) {
    for (const err of parsed.errors) {
      const msg = ts.flattenDiagnosticMessageText(err.messageText, '\n');
      logger?.warn(`[kindscript] tsconfig.json warning: ${msg}`);
    }
  }

  return { options: parsed.options, fileNames: parsed.fileNames };
}

export class KSLanguageServiceHost implements ts.LanguageServiceHost {
  private fileVersions = new Map<string, number>();
  private projectVersion = 0;
  private compilerOptions: ts.CompilerOptions;
  private rootFileNames: string[];
  private logger?: HostLogger;

  constructor(
    private workspaceRoot: string,
    private documents: TextDocuments<TextDocument>,
    logger?: HostLogger,
  ) {
    this.logger = logger;

    const tsconfigPath = ts.findConfigFile(workspaceRoot, ts.sys.fileExists, 'tsconfig.json');
    if (tsconfigPath) {
      const result = parseTsConfig(tsconfigPath, logger);
      this.compilerOptions = result.options;
      this.rootFileNames = result.fileNames;
    } else {
      this.compilerOptions = { ...DEFAULT_OPTIONS };
      this.rootFileNames = [];
    }
  }

  // ── ts.LanguageServiceHost interface ──────────────────────────────

  getCompilationSettings(): ts.CompilerOptions {
    return this.compilerOptions;
  }

  getScriptFileNames(): string[] {
    return this.rootFileNames;
  }

  getScriptVersion(fileName: string): string {
    return String(this.fileVersions.get(fileName) ?? 0);
  }

  getScriptSnapshot(fileName: string): ts.IScriptSnapshot | undefined {
    // Prefer open document content
    const uri = filePathToUri(fileName);
    const doc = this.documents.get(uri);
    if (doc) {
      return ts.ScriptSnapshot.fromString(doc.getText());
    }

    // Fall back to disk
    if (!ts.sys.fileExists(fileName)) return undefined;
    const content = ts.sys.readFile(fileName);
    if (content === undefined) return undefined;
    return ts.ScriptSnapshot.fromString(content);
  }

  getCurrentDirectory(): string {
    return this.workspaceRoot;
  }

  getDefaultLibFileName(options: ts.CompilerOptions): string {
    return ts.getDefaultLibFilePath(options);
  }

  fileExists(fileName: string): boolean {
    return ts.sys.fileExists(fileName);
  }

  readFile(fileName: string): string | undefined {
    return ts.sys.readFile(fileName);
  }

  readDirectory(
    dirPath: string,
    extensions?: readonly string[],
    exclude?: readonly string[],
    include?: readonly string[],
    depth?: number,
  ): string[] {
    return ts.sys.readDirectory(dirPath, extensions, exclude, include, depth);
  }

  directoryExists(dirName: string): boolean {
    return ts.sys.directoryExists(dirName);
  }

  getProjectVersion(): string {
    return String(this.projectVersion);
  }

  // ── Server-managed state ──────────────────────────────────────────

  /** Bump version for a specific file (triggers re-parse on next getProgram). */
  bumpVersion(fileName: string): void {
    const current = this.fileVersions.get(fileName) ?? 0;
    this.fileVersions.set(fileName, current + 1);
    this.projectVersion++;
  }

  /** Get the current root file names (for analysis). */
  getRootFileNames(): string[] {
    return this.rootFileNames;
  }

  /** Re-read tsconfig.json and update compiler options + root files. */
  reloadConfig(): void {
    const tsconfigPath = ts.findConfigFile(this.workspaceRoot, ts.sys.fileExists, 'tsconfig.json');
    if (tsconfigPath) {
      const result = parseTsConfig(tsconfigPath, this.logger);
      this.compilerOptions = result.options;
      this.rootFileNames = result.fileNames;
      this.projectVersion++;
    }
  }
}
