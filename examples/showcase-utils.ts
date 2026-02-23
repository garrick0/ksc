/**
 * Utilities for the compiler dashboard showcase.
 *
 * Handles temp folder lifecycle, data injection into dashboard HTML,
 * and serving via a local HTTP server.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as http from 'node:http';
import * as readline from 'node:readline';
import { execSync } from 'node:child_process';
import type { DashboardExportData } from '../src/export.js';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEMP_DIR = path.join(PROJECT_ROOT, '.showcase-tmp');
const TEMP_PROJECT = path.join(TEMP_DIR, 'project');
const DASHBOARD_HTML = path.join(PROJECT_ROOT, 'docs', 'compiler-dashboard.html');

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

  // Discover .ts files in the cloned project
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
  // Only discover files in src/ — avoids tests crowding the dashboard
  const srcDir = path.join(rootDir, 'src');
  if (fs.existsSync(srcDir)) {
    const srcFiles = findAllTsFiles(srcDir);
    if (srcFiles.length > 0) return srcFiles;
  }

  // Fallback: all .ts files in the project
  return findAllTsFiles(rootDir);
}

// ── Dashboard serving ───────────────────────────────────────────────────

export function serveDashboard(data: DashboardExportData): Promise<http.Server> {
  const html = fs.readFileSync(DASHBOARD_HTML, 'utf-8');

  // Replace the data between the markers
  const dataJs = `// __DASHBOARD_DATA_START__\nconst SAMPLE_DATA = ${JSON.stringify(data, null, 2)};\n// __DASHBOARD_DATA_END__`;
  const injected = html.replace(
    /\/\/ __DASHBOARD_DATA_START__[\s\S]*?\/\/ __DASHBOARD_DATA_END__/,
    dataJs,
  );

  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(injected);
    });

    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 3000;
      const url = `http://localhost:${port}`;

      console.log(`  Dashboard running at ${url}`);
      console.log('  Press Ctrl+C to stop.\n');

      // Open browser (macOS)
      try {
        execSync(`open ${url}`, { stdio: 'ignore' });
      } catch {
        // Non-macOS or open failed — user can navigate manually
      }

      resolve(server);
    });
  });
}
