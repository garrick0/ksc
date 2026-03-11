/**
 * P3-20: Config validation tests.
 *
 * Tests the CLI argument parsing for depth validation and
 * config discovery edge cases.
 */
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { parseArgv, CLIError } from '../../apps/cli/cli.js';
import { findConfig } from '../../src/application/config.js';

// ── parseArgv depth validation ────────────────────────────────────────

describe('parseArgv — depth validation', () => {
  it('accepts depth=parse', () => {
    const opts = parseArgv(['node', 'ksc', 'check', '--depth', 'parse']);
    expect(opts.depth).toBe('parse');
  });

  it('accepts depth=bind', () => {
    const opts = parseArgv(['node', 'ksc', 'check', '--depth', 'bind']);
    expect(opts.depth).toBe('bind');
  });

  it('accepts depth=check', () => {
    const opts = parseArgv(['node', 'ksc', 'check', '--depth', 'check']);
    expect(opts.depth).toBe('check');
  });

  it('defaults depth to undefined when not specified', () => {
    const opts = parseArgv(['node', 'ksc', 'check']);
    expect(opts.depth).toBeUndefined();
  });

  it('throws CLIError for invalid depth value', () => {
    expect(() => parseArgv(['node', 'ksc', 'check', '--depth', 'invalid']))
      .toThrow(CLIError);
    expect(() => parseArgv(['node', 'ksc', 'check', '--depth', 'invalid']))
      .toThrow("Invalid --depth value 'invalid'");
  });

  it('throws CLIError for invalid --depth= value', () => {
    expect(() => parseArgv(['node', 'ksc', 'check', '--depth=banana']))
      .toThrow(CLIError);
  });
});

// ── findConfig edge cases ─────────────────────────────────────────────

describe('findConfig — edge cases', () => {
  it('returns undefined for empty temp directory', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ksc-cfg-test-'));
    try {
      expect(findConfig(tmpDir)).toBeUndefined();
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('finds kindscript.config.js', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ksc-cfg-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'kindscript.config.js'), 'module.exports = {}');
      const result = findConfig(tmpDir);
      expect(result).toBe(path.join(tmpDir, 'kindscript.config.js'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('finds ksc.config.js', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ksc-cfg-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'ksc.config.js'), 'module.exports = {}');
      const result = findConfig(tmpDir);
      expect(result).toBe(path.join(tmpDir, 'ksc.config.js'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('prefers .ts over .js for same base name', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ksc-cfg-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'kindscript.config.ts'), 'export default {}');
      fs.writeFileSync(path.join(tmpDir, 'kindscript.config.js'), 'module.exports = {}');
      const result = findConfig(tmpDir);
      // kindscript.config.ts comes first in CONFIG_NAMES order
      expect(result).toBe(path.join(tmpDir, 'kindscript.config.ts'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('does not find unrelated config files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ksc-cfg-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}');
      fs.writeFileSync(path.join(tmpDir, 'jest.config.ts'), 'export default {}');
      expect(findConfig(tmpDir)).toBeUndefined();
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});
