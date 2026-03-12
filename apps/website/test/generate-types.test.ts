import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

const WEBSITE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(WEBSITE_ROOT, '../..');
const OUTPUT_PATH = path.join(WEBSITE_ROOT, 'src/lib/lessons/kindscript-types.ts');

describe('generate-types.mjs', () => {
  it('generates kindscript-types.ts from src/api.ts', () => {
    // Run the script
    execSync('node apps/website/scripts/generate-types.mjs', { cwd: REPO_ROOT });

    expect(fs.existsSync(OUTPUT_PATH)).toBe(true);
    const content = fs.readFileSync(OUTPUT_PATH, 'utf-8');

    // Should have the auto-generated header
    expect(content).toContain('AUTO-GENERATED from src/api.ts');

    // Should export KINDSCRIPT_TYPES
    expect(content).toContain('export const KINDSCRIPT_TYPES');

    // Should contain key API types
    expect(content).toContain('PropertySet');
    expect(content).toContain('Kind<R extends PropertySet>');
    expect(content).toContain('KindScriptConfig');
    expect(content).toContain('defineConfig');
    expect(content).toContain('AnalysisDepth');

    // Should include the protobuf config (was missing from hardcoded version)
    expect(content).toContain('protobuf');
  });

  it('produces valid TypeScript string literal', () => {
    const content = fs.readFileSync(OUTPUT_PATH, 'utf-8');

    // The exported value should be a JSON-encoded string
    const match = content.match(/export const KINDSCRIPT_TYPES = (".*");/s);
    expect(match).not.toBeNull();

    // Should parse as valid JSON string
    const parsed = JSON.parse(match![1]);
    expect(typeof parsed).toBe('string');

    // Should be a valid declare module block
    expect(parsed).toContain("declare module 'kindscript'");
  });
});
