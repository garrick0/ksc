import { describe, it, expect } from 'vitest';
import { ks } from '../src/api/ks.js';

describe('ks builder', () => {
  it('ks.file() returns a file value with path metadata', () => {
    const file = ks.file('./src/domain/user.service.ts');
    expect(file.path).toBe('./src/domain/user.service.ts');
    expect(file.filename).toBe('user.service.ts');
    expect(file.extension).toBe('.ts');
  });

  it('ks.dir() returns a directory value with path metadata', () => {
    const dir = ks.dir('./src/domain');
    expect(dir.path).toBe('./src/domain');
    expect(dir.name).toBe('domain');
  });

  it('ks.file() handles files without extension', () => {
    const file = ks.file('./Makefile');
    expect(file.path).toBe('./Makefile');
    expect(file.filename).toBe('Makefile');
    expect(file.extension).toBe('');
  });

  it('ks.dir() handles nested paths', () => {
    const dir = ks.dir('./src/domain/models');
    expect(dir.path).toBe('./src/domain/models');
    expect(dir.name).toBe('models');
  });
});
