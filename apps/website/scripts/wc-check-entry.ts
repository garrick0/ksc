/**
 * Minimal CLI entry point for running `ksc check` inside WebContainer.
 *
 * Bundled with esbuild into a single file (typescript marked external).
 * Usage: node ksc-check.mjs <rootDir>
 */

import { checkProject } from '../../../src/application/index.js';

async function main() {
  const rootDir = process.argv[2] || '.';

  const result = await checkProject(rootDir);

  if (result.fileCount === 0) {
    console.error('No TypeScript files found.');
    process.exit(2);
  }

  if (result.diagnostics.length > 0) {
    console.log('');
    for (const diag of result.diagnostics) {
      console.log(`  ${diag.message}`);
    }
    console.log('');
  }

  const status = result.diagnostics.length > 0
    ? `${result.diagnostics.length} violation${result.diagnostics.length === 1 ? '' : 's'} found`
    : 'no violations';
  console.log(`ksc: ${result.fileCount} files, ${result.definitions.length} kinds, ${status}.`);

  process.exit(result.diagnostics.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(2);
});
