/**
 * KindScript Language Server — entry point.
 *
 * Creates an LSP connection, initializes the TypeScript LanguageService
 * and KindScript analyzer, and pushes diagnostics on file changes.
 *
 * This is the process entry point — exports nothing.
 */

import {
  createConnection,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
  DidChangeWatchedFilesNotification,
  type InitializeParams,
  type InitializeResult,
} from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import ts from 'typescript';
import * as path from 'node:path';

import { KSLanguageServiceHost } from './ts-host.js';
import { Analyzer } from './analyzer.js';
import { mapDiagnostics, textDocumentFromFile } from './diagnostic-mapper.js';
import { getCodeActions } from './code-actions.js';
import { AnalysisScheduler } from './debounce.js';
import { uriToFilePath, filePathToUri } from './uri.js';
import { resolveConfig } from '../../../src/application/config.js';

// ── Connection and documents ──────────────────────────────────────

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

// ── State ─────────────────────────────────────────────────────────

let tsHost: KSLanguageServiceHost;
let tsLanguageService: ts.LanguageService;
let analyzer: Analyzer;
let scheduler: AnalysisScheduler;
let workspaceRoot: string;
let severitySetting = 'warning';
let enabled = true;

// ── Initialize ────────────────────────────────────────────────────

connection.onInitialize((params: InitializeParams): InitializeResult => {
  workspaceRoot = params.workspaceFolders?.[0]?.uri
    ? uriToFilePath(params.workspaceFolders[0].uri)
    : process.cwd();

  connection.console.log(`[kindscript] Initializing for workspace: ${workspaceRoot}`);

  // Create TS LanguageService
  tsHost = new KSLanguageServiceHost(workspaceRoot, documents, {
    warn: (msg) => connection.console.warn(msg),
  });
  tsLanguageService = ts.createLanguageService(
    tsHost,
    ts.createDocumentRegistry(),
  );

  // Create analyzer
  analyzer = new Analyzer({
    error: (msg) => connection.console.error(msg),
  });
  scheduler = new AnalysisScheduler(500);

  // Load KindScript config
  loadKSConfig();

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      codeActionProvider: {
        codeActionKinds: ['quickfix'],
      },
    },
  };
});

connection.onInitialized(() => {
  // Register file watchers
  connection.client.register(DidChangeWatchedFilesNotification.type, {
    watchers: [
      { globPattern: '**/*.ts' },
      { globPattern: '**/*.tsx' },
      { globPattern: '**/tsconfig.json' },
      { globPattern: '**/ksc.config.ts' },
      { globPattern: '**/ksc.config.js' },
      { globPattern: '**/kindscript.config.ts' },
      { globPattern: '**/kindscript.config.js' },
    ],
  });

  // Run initial analysis
  scheduleAnalysis();
});

// ── Document sync ─────────────────────────────────────────────────

documents.onDidChangeContent(change => {
  const filePath = uriToFilePath(change.document.uri);
  tsHost.bumpVersion(filePath);
  scheduleAnalysis();
});

documents.onDidOpen(() => {
  // Diagnostics might already be cached — push them immediately
  scheduleAnalysis();
});

// ── File watcher ──────────────────────────────────────────────────

connection.onDidChangeWatchedFiles(params => {
  let configReloading = false;

  for (const change of params.changes) {
    const filePath = uriToFilePath(change.uri);

    // If tsconfig changed, reload compiler settings
    if (filePath.endsWith('tsconfig.json')) {
      connection.console.log('[kindscript] tsconfig.json changed — reloading');
      tsHost.reloadConfig();
    }

    // If KindScript config changed, reload it (loadKSConfig schedules analysis after load)
    if (isKSConfigFile(filePath)) {
      connection.console.log('[kindscript] KindScript config changed — reloading');
      loadKSConfig();
      configReloading = true;
    }

    // Bump version for TS files
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      tsHost.bumpVersion(filePath);
    }
  }

  // Skip if config reload already scheduled analysis (avoids stale-config run)
  if (!configReloading) {
    scheduleAnalysis();
  }
});

// ── Code actions ──────────────────────────────────────────────────

connection.onCodeAction(params => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];
  return getCodeActions(params, document);
});

// ── Configuration ─────────────────────────────────────────────────

connection.onDidChangeConfiguration(params => {
  const settings = params.settings?.kindscript;
  if (settings) {
    if (typeof settings.severity === 'string') {
      severitySetting = settings.severity;
    }
    const wasEnabled = enabled;
    if (typeof settings.enable === 'boolean') {
      enabled = settings.enable;
    }
    if (!enabled) {
      // Clear all diagnostics and stop
      for (const [fileName] of analyzer.getLastDiagnostics()) {
        connection.sendDiagnostics({
          uri: filePathToUri(fileName),
          diagnostics: [],
        });
      }
      return;
    }
    // If re-enabled, trigger analysis
    if (!wasEnabled && enabled) {
      scheduleAnalysis();
      return;
    }
  }
  scheduleAnalysis();
});

// ── Analysis ──────────────────────────────────────────────────────

function scheduleAnalysis(): void {
  scheduler.schedule(() => runAnalysis());
}

function runAnalysis(): void {
  if (!enabled) return;
  connection.console.log('[kindscript] Running analysis...');

  const diagnosticsByFile = analyzer.analyze(tsLanguageService);

  // Push diagnostics for each file
  for (const [fileName, ksDiags] of diagnosticsByFile) {
    // Get TextDocument for position mapping
    const uri = filePathToUri(fileName);
    let doc = documents.get(uri);
    if (!doc) {
      doc = textDocumentFromFile(fileName);
    }

    if (doc) {
      const lspDiags = mapDiagnostics(ksDiags, doc, severitySetting);
      connection.sendDiagnostics({ uri, diagnostics: lspDiags });
    }
  }

  const totalDiags = [...diagnosticsByFile.values()].reduce((sum, d) => sum + d.length, 0);
  connection.console.log(
    `[kindscript] Analysis complete: ${totalDiags} diagnostics across ${diagnosticsByFile.size} files`,
  );
}

// ── Config loading ────────────────────────────────────────────────

function loadKSConfig(): void {
  resolveConfig({ rootDir: workspaceRoot })
    .then(config => {
      analyzer.updateConfig(config);
      connection.console.log('[kindscript] Config loaded');
      // Re-analyze with the real config to fix any stale diagnostics
      scheduleAnalysis();
    })
    .catch(err => {
      connection.console.warn(`[kindscript] Failed to load config: ${err}`);
    });
}

function isKSConfigFile(filePath: string): boolean {
  const base = path.basename(filePath);
  return [
    'ksc.config.ts', 'ksc.config.js',
    'kindscript.config.ts', 'kindscript.config.js',
  ].includes(base);
}

// ── Shutdown ──────────────────────────────────────────────────────

connection.onShutdown(() => {
  scheduler.dispose();
  tsLanguageService.dispose();
});

// ── Start ─────────────────────────────────────────────────────────

documents.listen(connection);
connection.listen();
