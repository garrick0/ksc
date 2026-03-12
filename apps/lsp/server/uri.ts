/**
 * URI utilities — correct conversion between file paths and LSP URIs.
 *
 * Uses vscode-uri for proper encoding/decoding, Windows path handling,
 * and special character support.
 */

import { URI } from 'vscode-uri';

/** Convert a file:// URI to a local file path. */
export function uriToFilePath(uri: string): string {
  return URI.parse(uri).fsPath;
}

/** Convert a local file path to a file:// URI string. */
export function filePathToUri(filePath: string): string {
  return URI.file(filePath).toString();
}
