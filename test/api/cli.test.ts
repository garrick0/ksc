/**
 * Tests for the KindScript CLI (app/cli.ts).
 *
 * Tests argument parsing, config discovery, file discovery, and init command.
 * Watch mode is not tested (requires filesystem events).
 */
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import {
  parseArgv,
  findConfig,
  findRootFiles,
  EXIT_SUCCESS,
  EXIT_VIOLATIONS,
  EXIT_ERROR,
} from '../../app/cli/cli.js';

const FIXTURES = path.resolve(__dirname, '../fixtures');

// ── parseArgv ─────────────────────────────────────────────────────────

describe('parseArgv', () => {
  it('defaults to check command', () => {
    const opts = parseArgv(['node', 'ksc']);
    expect(opts.command).toBe('check');
    expect(opts.json).toBe(false);
    expect(opts.watch).toBe(false);
    expect(opts.depth).toBe('check');
  });

  it('parses check command', () => {
    const opts = parseArgv(['node', 'ksc', 'check']);
    expect(opts.command).toBe('check');
  });

  it('parses init command', () => {
    const opts = parseArgv(['node', 'ksc', 'init']);
    expect(opts.command).toBe('init');
  });

  it('parses --json flag', () => {
    const opts = parseArgv(['node', 'ksc', 'check', '--json']);
    expect(opts.json).toBe(true);
  });

  it('parses --watch flag', () => {
    const opts = parseArgv(['node', 'ksc', 'check', '--watch']);
    expect(opts.watch).toBe(true);
  });

  it('parses -w shorthand', () => {
    const opts = parseArgv(['node', 'ksc', 'check', '-w']);
    expect(opts.watch).toBe(true);
  });

  it('parses --config with separate value', () => {
    const opts = parseArgv(['node', 'ksc', 'check', '--config', 'my.config.ts']);
    expect(opts.configPath).toBe('my.config.ts');
  });

  it('parses --config=value format', () => {
    const opts = parseArgv(['node', 'ksc', 'check', '--config=my.config.ts']);
    expect(opts.configPath).toBe('my.config.ts');
  });

  it('parses --depth with valid value', () => {
    const opts = parseArgv(['node', 'ksc', 'check', '--depth', 'parse']);
    expect(opts.depth).toBe('parse');
  });

  it('parses --depth=value format', () => {
    const opts = parseArgv(['node', 'ksc', 'check', '--depth=bind']);
    expect(opts.depth).toBe('bind');
  });

  it('parses multiple flags together', () => {
    const opts = parseArgv([
      'node', 'ksc', 'check',
      '--json', '--watch', '--depth', 'parse', '--config', 'foo.ts',
    ]);
    expect(opts.json).toBe(true);
    expect(opts.watch).toBe(true);
    expect(opts.depth).toBe('parse');
    expect(opts.configPath).toBe('foo.ts');
  });

  it('parses help variants', () => {
    expect(parseArgv(['node', 'ksc', '--help']).command).toBe('--help');
    expect(parseArgv(['node', 'ksc', '-h']).command).toBe('-h');
    expect(parseArgv(['node', 'ksc', 'help']).command).toBe('help');
  });

  it('parses version variants', () => {
    expect(parseArgv(['node', 'ksc', '--version']).command).toBe('--version');
    expect(parseArgv(['node', 'ksc', '-v']).command).toBe('-v');
  });

  it('unknown command is passed through', () => {
    const opts = parseArgv(['node', 'ksc', 'foobar']);
    expect(opts.command).toBe('foobar');
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

  it('finds kindscript.config.ts', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ksc-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'kindscript.config.ts'), 'export default {}');
      const result = findConfig(tmpDir);
      expect(result).toBe(path.join(tmpDir, 'kindscript.config.ts'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('finds ksc.config.ts', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ksc-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'ksc.config.ts'), 'export default {}');
      const result = findConfig(tmpDir);
      expect(result).toBe(path.join(tmpDir, 'ksc.config.ts'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('prefers kindscript.config.ts over ksc.config.ts', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ksc-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'kindscript.config.ts'), 'export default {}');
      fs.writeFileSync(path.join(tmpDir, 'ksc.config.ts'), 'export default {}');
      const result = findConfig(tmpDir);
      expect(result).toBe(path.join(tmpDir, 'kindscript.config.ts'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});

// ── findRootFiles ─────────────────────────────────────────────────────

describe('findRootFiles', () => {
  it('finds .ts files in fixtures', () => {
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

  it('falls back to root when src/ is empty', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ksc-test-'));
    try {
      fs.mkdirSync(path.join(tmpDir, 'src'));
      fs.writeFileSync(path.join(tmpDir, 'root.ts'), 'const y = 2;');

      const files = findRootFiles(tmpDir);
      expect(files.length).toBe(1);
      expect(files[0]).toContain('root.ts');
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

  it('skips .d.ts files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ksc-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'types.d.ts'), 'declare const x: number;');
      fs.writeFileSync(path.join(tmpDir, 'real.ts'), 'const y = 2;');

      const files = findRootFiles(tmpDir);
      expect(files.length).toBe(1);
      expect(files[0]).toContain('real.ts');
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('returns empty for directory with no ts files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ksc-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'readme.md'), '# hello');
      const files = findRootFiles(tmpDir);
      expect(files.length).toBe(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});

// ── Exit codes ────────────────────────────────────────────────────────

describe('exit codes', () => {
  it('EXIT_SUCCESS is 0', () => {
    expect(EXIT_SUCCESS).toBe(0);
  });

  it('EXIT_VIOLATIONS is 1', () => {
    expect(EXIT_VIOLATIONS).toBe(1);
  });

  it('EXIT_ERROR is 2', () => {
    expect(EXIT_ERROR).toBe(2);
  });
});
