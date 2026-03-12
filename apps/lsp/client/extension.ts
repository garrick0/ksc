/**
 * KindScript VS Code extension — thin client.
 *
 * Spawns the KindScript language server and manages its lifecycle.
 * The server does all the heavy lifting; this is just the VS Code integration glue.
 */

import * as path from 'node:path';
import { workspace, type ExtensionContext } from 'vscode';
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node.js';

let client: LanguageClient | undefined;

export function activate(context: ExtensionContext): void {
  const serverModule = context.asAbsolutePath(path.join('dist', 'server.cjs'));

  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] },
    },
  };

  const fileWatcher = workspace.createFileSystemWatcher('**/*.ts');
  context.subscriptions.push(fileWatcher);

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'typescript' },
      { scheme: 'file', language: 'typescriptreact' },
    ],
    synchronize: {
      configurationSection: 'kindscript',
      fileEvents: fileWatcher,
    },
  };

  client = new LanguageClient(
    'kindscript',
    'KindScript',
    serverOptions,
    clientOptions,
  );

  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) return undefined;
  return client.stop();
}
