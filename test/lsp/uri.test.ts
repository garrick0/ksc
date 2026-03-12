/**
 * Tests for URI utilities.
 *
 * Verifies correct round-tripping between file paths and file:// URIs,
 * including edge cases (spaces, special characters).
 */

import { describe, it, expect } from 'vitest';
import { uriToFilePath, filePathToUri } from '../../apps/lsp/server/uri.js';

describe('URI utilities', () => {
  it('converts file path to URI', () => {
    const uri = filePathToUri('/tmp/test.ts');
    expect(uri).toBe('file:///tmp/test.ts');
  });

  it('converts URI to file path', () => {
    const path = uriToFilePath('file:///tmp/test.ts');
    expect(path).toBe('/tmp/test.ts');
  });

  it('round-trips simple paths', () => {
    const original = '/Users/dev/project/src/index.ts';
    const result = uriToFilePath(filePathToUri(original));
    expect(result).toBe(original);
  });

  it('handles paths with spaces', () => {
    const original = '/Users/dev/my project/src/index.ts';
    const uri = filePathToUri(original);
    expect(uri).toContain('%20');
    const result = uriToFilePath(uri);
    expect(result).toBe(original);
  });

  it('handles URI-encoded spaces', () => {
    const uri = 'file:///tmp/my%20project/test.ts';
    const path = uriToFilePath(uri);
    expect(path).toBe('/tmp/my project/test.ts');
  });
});
