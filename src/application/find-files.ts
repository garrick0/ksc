/**
 * Use case: Discover TypeScript source files in a project.
 *
 * Walks the directory tree collecting .ts files (excluding .d.ts).
 * Prefers src/ if it exists and contains .ts files.
 * Supports include/exclude glob patterns from config.
 */

import * as path from 'node:path';
import * as fs from 'node:fs';

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist']);

export interface FindFilesOptions {
  /** Glob patterns for files to include. */
  include?: readonly string[];
  /** Glob patterns for files to exclude. */
  exclude?: readonly string[];
}

/**
 * Match a file path against a simple glob pattern.
 * Supports * (single segment) and ** (recursive) wildcards.
 */
function matchGlob(filePath: string, pattern: string): boolean {
  // Normalize to forward slashes
  const normalized = filePath.replace(/\\/g, '/');
  // Convert glob to regex
  const regex = pattern
    .replace(/\\/g, '/')
    .replace(/[.+^${}()|[\]]/g, '\\$&')
    .replace(/\*\*/g, '\0')
    .replace(/\*/g, '[^/]*')
    .replace(/\0/g, '.*');
  return new RegExp(`(^|/)${regex}$`).test(normalized);
}

export function findRootFiles(rootDir: string, options?: FindFilesOptions): string[] {
  const results: string[] = [];
  function walk(dir: string) {
    let entries: string[];
    try { entries = fs.readdirSync(dir); } catch { return; }
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry)) continue;
      const full = path.join(dir, entry);
      try {
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walk(full);
        else if ((entry.endsWith('.ts') || entry.endsWith('.tsx')) && !entry.endsWith('.d.ts')) results.push(full);
      } catch { /* skip */ }
    }
  }

  const srcDir = path.join(rootDir, 'src');
  if (fs.existsSync(srcDir)) {
    walk(srcDir);
    if (results.length > 0) return applyFilters(results, rootDir, options);
  }

  walk(rootDir);
  return applyFilters(results, rootDir, options);
}

function applyFilters(files: string[], rootDir: string, options?: FindFilesOptions): string[] {
  if (!options?.include?.length && !options?.exclude?.length) return files;

  let filtered = files;

  if (options.include && options.include.length > 0) {
    filtered = filtered.filter(f => {
      const rel = path.relative(rootDir, f);
      return options.include!.some(pattern => matchGlob(rel, pattern));
    });
  }

  if (options.exclude && options.exclude.length > 0) {
    filtered = filtered.filter(f => {
      const rel = path.relative(rootDir, f);
      return !options.exclude!.some(pattern => matchGlob(rel, pattern));
    });
  }

  return filtered;
}
