import { describe, it, expect } from 'vitest';
import { ksBind } from '../src/binder.js';
import { defineConfig } from '../src/config.js';

// ────────────────────────────────────────────────────────────────────────

describe('binder — simple targets', () => {
  it('creates symbols from config entries', () => {
    const config = defineConfig({
      domain: { path: './src/domain', rules: { pure: true, noIO: true } },
      infrastructure: { path: './src/infrastructure' },
    });
    const result = ksBind(config);

    expect(result.symbols).toHaveLength(2);
    expect(result.targets).toHaveLength(2);
  });

  it('extracts name and rules', () => {
    const config = defineConfig({
      domain: { path: './src/domain', rules: { pure: true, noIO: true } },
    });
    const result = ksBind(config);
    const sym = result.symbols[0];

    expect(sym.name).toBe('domain');
    expect(sym.declaredProperties).toEqual({ pure: true, noIO: true });
  });

  it('handles entries with no rules', () => {
    const config = defineConfig({
      infra: { path: './src/infrastructure' },
    });
    const result = ksBind(config);
    const sym = result.symbols[0];

    expect(sym.name).toBe('infra');
    expect(sym.declaredProperties).toEqual({});
  });

  it('extracts path from entries', () => {
    const config = defineConfig({
      domain: { path: './src/domain' },
    });
    const result = ksBind(config);
    expect(result.symbols[0].path).toBe('./src/domain');
  });

  it('detects directory targets (no file extension)', () => {
    const config = defineConfig({
      domain: { path: './src/domain' },
    });
    const result = ksBind(config);
    expect(result.symbols[0].valueKind).toBe('directory');
  });

  it('detects file targets (has file extension)', () => {
    const config = defineConfig({
      utils: { path: './src/utils.ts' },
    });
    const result = ksBind(config);
    expect(result.symbols[0].valueKind).toBe('file');
  });

  it('assigns unique IDs', () => {
    const config = defineConfig({
      a: { path: './a' },
      b: { path: './b' },
      c: { path: './c' },
    });
    const result = ksBind(config);
    const ids = result.symbols.map(s => s.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('handles numeric properties (maxFanOut)', () => {
    const config = defineConfig({
      controllers: { path: './src/controllers', rules: { maxFanOut: 5 } },
    });
    const result = ksBind(config);
    expect(result.symbols[0].declaredProperties.maxFanOut).toBe(5);
  });

  it('handles string properties (scope)', () => {
    const config = defineConfig({
      modules: { path: './src/modules', rules: { scope: 'folder' } },
    });
    const result = ksBind(config);
    expect(result.symbols[0].declaredProperties.scope).toBe('folder');
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('binder — composite targets', () => {
  const config = defineConfig({
    app: {
      members: {
        domain: { path: './src/domain', rules: { pure: true, noIO: true } },
        infrastructure: { path: './src/infrastructure' },
        application: { path: './src/application', rules: { noConsole: true } },
      },
      rules: {
        noDependency: [['domain', 'infrastructure'], ['domain', 'application']],
        noCycles: ['domain', 'infrastructure', 'application'],
      },
    },
  });

  it('creates member symbols and composite symbol', () => {
    const result = ksBind(config);
    // 3 members + 1 composite
    expect(result.symbols).toHaveLength(4);
    // Only 1 top-level target (the composite)
    expect(result.targets).toHaveLength(1);
  });

  it('composite symbol has correct name and valueKind', () => {
    const result = ksBind(config);
    const composite = result.targets[0];
    expect(composite.name).toBe('app');
    expect(composite.valueKind).toBe('composite');
  });

  it('extracts relational properties: noDependency', () => {
    const result = ksBind(config);
    const composite = result.targets[0];
    expect(composite.declaredProperties.noDependency).toEqual([
      ['domain', 'infrastructure'],
      ['domain', 'application'],
    ]);
  });

  it('extracts relational properties: noCycles', () => {
    const result = ksBind(config);
    const composite = result.targets[0];
    expect(composite.declaredProperties.noCycles).toEqual([
      'domain',
      'infrastructure',
      'application',
    ]);
  });

  it('resolves composite members', () => {
    const result = ksBind(config);
    const composite = result.targets[0];
    expect(composite.members).toBeDefined();
    expect(composite.members!.size).toBe(3);

    const memberNames = [...composite.members!.keys()];
    expect(memberNames).toContain('domain');
    expect(memberNames).toContain('infrastructure');
    expect(memberNames).toContain('application');
  });

  it('members carry their declared rules', () => {
    const result = ksBind(config);
    const composite = result.targets[0];

    const domain = composite.members!.get('domain')!;
    expect(domain.declaredProperties).toEqual({ pure: true, noIO: true });

    const infra = composite.members!.get('infrastructure')!;
    expect(infra.declaredProperties).toEqual({});

    const app = composite.members!.get('application')!;
    expect(app.declaredProperties).toEqual({ noConsole: true });
  });

  it('members have paths and valueKind', () => {
    const result = ksBind(config);
    const composite = result.targets[0];

    const domain = composite.members!.get('domain')!;
    expect(domain.path).toBe('./src/domain');
    expect(domain.valueKind).toBe('directory');

    const infra = composite.members!.get('infrastructure')!;
    expect(infra.path).toBe('./src/infrastructure');
    expect(infra.valueKind).toBe('directory');
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('binder — empty config', () => {
  it('produces empty results for empty config', () => {
    const result = ksBind({});
    expect(result.symbols).toEqual([]);
    expect(result.targets).toEqual([]);
  });
});
