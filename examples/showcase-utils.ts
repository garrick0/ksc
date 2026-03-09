/**
 * Utilities for the AST explorer showcase.
 *
 * Handles temp folder lifecycle and serving via Vite dev server.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { execSync } from 'node:child_process';
import type { ASTDashboardData } from '../grammar/export.js';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEMP_DIR = path.join(PROJECT_ROOT, '.showcase-tmp');
const TEMP_PROJECT = path.join(TEMP_DIR, 'project');

const REMOTE_URL = 'git@github.com:garrick0/ksc.git';
const FIXED_COMMIT = 'a58632bcb41f12d6c737c0f27742f329f0d1204f';

// ── User prompt ─────────────────────────────────────────────────────────

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// ── Temp folder management ──────────────────────────────────────────────

export async function checkAndCleanStale(): Promise<void> {
  if (!fs.existsSync(TEMP_DIR)) return;

  console.log(`\n  Found stale temp folder: ${TEMP_DIR}`);
  const answer = await prompt('  Clean up before proceeding? [Y/n] ');

  if (answer === 'n' || answer === 'no') {
    console.log('  Aborting — please remove the folder manually or allow cleanup.');
    process.exit(1);
  }

  console.log('  Removing stale temp folder...');
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  console.log('  Done.\n');
}

export async function setupTempProject(): Promise<{ root: string; rootFiles: string[] }> {
  await checkAndCleanStale();

  console.log('  Cloning fixed commit from remote...');
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  execSync(`git clone ${REMOTE_URL} ${TEMP_PROJECT}`, { stdio: 'pipe' });
  execSync(`git -C ${TEMP_PROJECT} checkout ${FIXED_COMMIT}`, { stdio: 'pipe' });

  console.log(`  Checked out ${FIXED_COMMIT.slice(0, 10)}...`);

  const rootFiles = discoverRootFiles(TEMP_PROJECT);

  console.log(`  Found ${rootFiles.length} root files.\n`);
  return { root: TEMP_PROJECT, rootFiles };
}

export function cleanupTemp(): void {
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    console.log('\n  Cleaned up temp folder.');
  }
}

// ── File discovery ──────────────────────────────────────────────────────

function findAllTsFiles(dir: string): string[] {
  const results: string[] = [];
  function walk(d: string) {
    let entries: string[];
    try { entries = fs.readdirSync(d); } catch { return; }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
      const full = path.join(d, entry);
      try {
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walk(full);
        else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) results.push(full);
      } catch { /* skip */ }
    }
  }
  walk(dir);
  return results;
}

// ── Root file discovery ─────────────────────────────────────────────────

export function discoverRootFiles(rootDir: string): string[] {
  const srcDir = path.join(rootDir, 'src');
  if (fs.existsSync(srcDir)) {
    const srcFiles = findAllTsFiles(srcDir);
    if (srcFiles.length > 0) return srcFiles;
  }

  return findAllTsFiles(rootDir);
}

// ── Dashboard serving (Vite) ────────────────────────────────────────────

export async function serveDashboard(data: ASTDashboardData): Promise<{ close: () => void }> {
  const { createServer } = await import('vite');
  const configPath = path.join(PROJECT_ROOT, 'dashboard', 'vite.config.ts');

  const server = await createServer({
    configFile: configPath,
    server: { port: 0, open: true },
    plugins: [{
      name: 'dashboard-data',
      configureServer(server) {
        server.middlewares.use('/__data__', (_req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        });
      },
    }],
  });

  await server.listen();
  const addr = server.httpServer?.address();
  const port = typeof addr === 'object' && addr ? addr.port : 5173;
  console.log(`  Dashboard running at http://localhost:${port}`);
  console.log('  Press Ctrl+C to stop.\n');

  return { close: () => server.close() };
}
