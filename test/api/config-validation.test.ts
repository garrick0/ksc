/**
 * P3-20: Config validation tests.
 *
 * Tests the CLI argument parsing for depth validation and
 * config discovery edge cases.
 */
import { describe, it, expect, vi } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { parseArgv, findConfig } from '../../app/cli/cli.js';

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

  it('defaults depth to check when not specified', () => {
    const opts = parseArgv(['node', 'ksc', 'check']);
    expect(opts.depth).toBe('check');
  });

  it('calls process.exit for invalid depth value', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => parseArgv(['node', 'ksc', 'check', '--depth', 'invalid']))
        .toThrow('process.exit called');
      expect(exitSpy).toHaveBeenCalledWith(2);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("invalid --depth value 'invalid'"),
      );
    } finally {
      exitSpy.mockRestore();
      stderrSpy.mockRestore();
    }
  });

  it('calls process.exit for invalid --depth= value', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => parseArgv(['node', 'ksc', 'check', '--depth=banana']))
        .toThrow('process.exit called');
      expect(exitSpy).toHaveBeenCalledWith(2);
    } finally {
      exitSpy.mockRestore();
      stderrSpy.mockRestore();
    }
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
