import * as path from 'node:path';
import * as fs from 'node:fs';
import { isAnalysisDepth } from '../../../../libs/types/src/index.ts';

const CONFIG_NAMES = [
  'ksc.config.ts',
  'ksc.config.js',
];

export function findConfig(rootDir) {
  for (const name of CONFIG_NAMES) {
    const full = path.join(rootDir, name);
    if (fs.existsSync(full)) return full;
  }
  return undefined;
}

export async function loadConfig(configPath) {
  const abs = path.resolve(configPath);
  let mod;
  try {
    mod = await import(abs);
  } catch (err) {
    throw new Error(`Failed to load config file '${configPath}': ${err instanceof Error ? err.message : err}`);
  }
  const raw = mod.default ?? mod;
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Config file must export an object: ${configPath}`);
  }
  const config = raw;
  if (config.analysisDepth !== undefined && !isAnalysisDepth(config.analysisDepth)) {
    throw new Error(
      `Invalid analysisDepth '${config.analysisDepth}' in config. Must be 'parse', 'bind', or 'check'.`,
    );
  }
  return config;
}

export async function resolveConfig(options) {
  const resolved = options.configPath
    ? path.resolve(options.configPath)
    : findConfig(options.rootDir);

  let config = {};
  if (resolved) {
    if (!fs.existsSync(resolved)) {
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
