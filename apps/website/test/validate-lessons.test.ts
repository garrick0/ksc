import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '../../..');

describe('validate-lessons.mjs', () => {
  it('validates all lessons without errors', () => {
    const output = execSync('node apps/website/scripts/validate-lessons.mjs', {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    });

    expect(output).toContain('All lessons valid');
    expect(output).not.toContain('error');
  });

  it('finds the hello-world lesson', () => {
    const output = execSync('node apps/website/scripts/validate-lessons.mjs', {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    });

    expect(output).toContain('1-1-hello-world');
    expect(output).toContain('lesson.json valid');
    expect(output).toContain('starter/ exists');
    expect(output).toContain('solution/ exists');
  });
});
