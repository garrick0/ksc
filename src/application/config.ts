/**
 * Use case: Config discovery, loading, and resolution.
 *
 * Discovers config files (kindscript.config.ts, ksc.config.ts, etc.),
 * loads them, validates their contents, and merges with overrides.
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import type { KindScriptConfig } from './types.js';
import { isAnalysisDepth } from '../api.js';

// ── Discovery ────────────────────────────────────────────────────────

const CONFIG_NAMES = [
  'kindscript.config.ts',
  'kindscript.config.js',
  'ksc.config.ts',
  'ksc.config.js',
];

/** Scan a directory for a KindScript config file. Returns the first match or undefined. */
export function findConfig(rootDir: string): string | undefined {
  for (const name of CONFIG_NAMES) {
    const full = path.join(rootDir, name);
    if (fs.existsSync(full)) return full;
  }
  return undefined;
}

// ── Loading ──────────────────────────────────────────────────────────

/** Load and validate a config file. Throws on invalid contents. */
export async function loadConfig(configPath: string): Promise<KindScriptConfig> {
  const abs = path.resolve(configPath);
  let mod: Record<string, unknown>;
  try {
    mod = await import(abs);
  } catch (err) {
    throw new Error(`Failed to load config file '${configPath}': ${err instanceof Error ? err.message : err}`);
  }
  const raw = mod.default ?? mod;
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Config file must export an object: ${configPath}`);
  }
  const config = raw as Record<string, unknown>;
  if (config.analysisDepth !== undefined && !isAnalysisDepth(config.analysisDepth)) {
    throw new Error(
      `Invalid analysisDepth '${config.analysisDepth}' in config. Must be 'parse', 'bind', or 'check'.`,
    );
  }
  return config as KindScriptConfig;
}

// ── Resolution ───────────────────────────────────────────────────────

/** Discover, load, and merge config with optional overrides. */
export async function resolveConfig(options: {
  configPath?: string;
  rootDir: string;
  overrides?: Partial<KindScriptConfig>;
}): Promise<KindScriptConfig> {
  const resolved = options.configPath
    ? path.resolve(options.configPath)
    : findConfig(options.rootDir);

  let config: KindScriptConfig = {};
  if (resolved) {
    if (!fs.existsSync(resolved)) {
      // Explicit --config pointing to a nonexistent file is an error
      if (options.configPath) {
        throw new Error(`Config file not found: ${resolved}`);
      }
    } else {
      config = await loadConfig(resolved);
    }
  }

  if (options.overrides) {
    config = { ...config, ...options.overrides };
  }

  return config;
}
