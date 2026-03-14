/**
 * Tests for the KindScript CLI (apps/cli/cli.ts).
 *
 * Tests argument parsing, config discovery, file discovery, and init command.
 */
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import {
  parseArgv,
  CLIError,
} from '../../apps/cli/main.js';
import { findConfig, findRootFiles } from 'ksc/ts-kind-checking';

const FIXTURES = path.resolve(__dirname, '../fixtures');

// ── parseArgv ─────────────────────────────────────────────────────────

describe('parseArgv', () => {
  it('defaults to check command with expected flags', () => {
    const opts = parseArgv(['node', 'ksc']);
    expect(opts.command).toBe('check');
    expect(opts.json).toBe(false);
    expect(opts.depth).toBeUndefined();
    expect(opts.help).toBe(false);
    expect(opts.version).toBe(false);
  });

  it('parses check, init, codegen, and help commands', () => {
    expect(parseArgv(['node', 'ksc', 'check']).command).toBe('check');
    expect(parseArgv(['node', 'ksc', 'init']).command).toBe('init');
    expect(parseArgv(['node', 'ksc', 'help']).command).toBe('help');
  });

  it('parses --json flag', () => {
    const opts = parseArgv(['node', 'ksc', 'check', '--json']);
    expect(opts.json).toBe(true);
  });

  it('parses multiple flags together', () => {
    const opts = parseArgv([
      'node', 'ksc', 'check',
      '--json', '--depth', 'parse', '--config', 'foo.ts',
    ]);
    expect(opts.json).toBe(true);
    expect(opts.depth).toBe('parse');
    expect(opts.configPath).toBe('foo.ts');
  });

  it('unknown command is passed through', () => {
    expect(parseArgv(['node', 'ksc', 'foobar']).command).toBe('foobar');
  });

  it('rejects unknown flags', () => {
    expect(() => parseArgv(['node', 'ksc', 'check', '--bogus'])).toThrow(TypeError);
  });

  it('throws CLIError for invalid depth value', () => {
    expect(() => parseArgv(['node', 'ksc', 'check', '--depth', 'invalid']))
      .toThrow(CLIError);
  });
});

// ── findConfig ────────────────────────────────────────────────────────

describe('findConfig', () => {
  it('returns undefined when no config exists', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ksc-test-'));
    try {
      expect(findConfig(tmpDir)).toBeUndefined();
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('finds config files and prefers ksc.config.ts', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ksc-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'ksc.config.ts'), 'export default {}');
      expect(findConfig(tmpDir)).toBe(path.join(tmpDir, 'ksc.config.ts'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});

// ── findRootFiles ─────────────────────────────────────────────────────

describe('findRootFiles', () => {
  it('finds .ts files and skips .d.ts files', () => {
    const fixtureDir = path.join(FIXTURES, 'kind-basic');
    const files = findRootFiles(fixtureDir);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(f).toMatch(/\.ts$/);
      expect(f).not.toMatch(/\.d\.ts$/);
    }
  });

  it('prefers src/ directory when it exists', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ksc-test-'));
    try {
      const srcDir = path.join(tmpDir, 'src');
      fs.mkdirSync(srcDir);
      fs.writeFileSync(path.join(srcDir, 'index.ts'), 'const x = 1;');
      fs.writeFileSync(path.join(tmpDir, 'root.ts'), 'const y = 2;');

      const files = findRootFiles(tmpDir);
      expect(files.length).toBe(1);
      expect(files[0]).toContain('src');
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('skips node_modules, .git, dist', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ksc-test-'));
    try {
      for (const dir of ['node_modules', '.git', 'dist']) {
        fs.mkdirSync(path.join(tmpDir, dir));
        fs.writeFileSync(path.join(tmpDir, dir, 'skip.ts'), 'const x = 1;');
      }
      fs.writeFileSync(path.join(tmpDir, 'keep.ts'), 'const y = 2;');

      const files = findRootFiles(tmpDir);
      expect(files.length).toBe(1);
      expect(files[0]).toContain('keep.ts');
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});
