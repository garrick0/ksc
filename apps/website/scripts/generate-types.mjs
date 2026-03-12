/**
 * Generate KindScript type declarations for Monaco editor.
 *
 * Reads src/api.ts and extracts the public API surface as a
 * `declare module 'kindscript'` block. This keeps CodeEditor.tsx
 * in sync with the actual package types automatically.
 *
 * Run: node apps/website/scripts/generate-types.mjs
 * (also runs as part of `npm run build` in the website workspace)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

const apiSource = fs.readFileSync(path.join(repoRoot, 'src/api.ts'), 'utf-8');

// Extract exported interfaces, types, and function signatures.
// Strip doc comments and implementation details.
const lines = apiSource.split('\n');
const declLines = [];
let inExport = false;
let braceDepth = 0;
let skipUntilBlank = false;

for (const line of lines) {
  const trimmed = line.trim();

  // Skip non-exported implementation details
  if (skipUntilBlank) {
    if (trimmed === '') skipUntilBlank = false;
    continue;
  }

  // Skip doc comments, single-line comments, and blank lines at top level
  if (!inExport && (trimmed.startsWith('/**') || trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed === '')) {
    continue;
  }

  // Skip internal constants and non-exported items
  if (!inExport && !trimmed.startsWith('export ')) {
    skipUntilBlank = true;
    continue;
  }

  // Export line — start collecting
  if (trimmed.startsWith('export ')) {
    inExport = true;

    // For functions, emit only the signature
    if (trimmed.startsWith('export function ')) {
      const sig = trimmed.replace(/\{[\s\S]*$/, '').trim();
      // Extract just the declaration
      const match = trimmed.match(/^export function (\w+)\(([^)]*)\):\s*([^{]+)/);
      if (match) {
        declLines.push(`  export function ${match[1]}(${match[2]}): ${match[3].trim()};`);
      }
      inExport = false;
      skipUntilBlank = true;
      continue;
    }
  }

  if (inExport) {
    // Count braces to track block boundaries
    for (const ch of trimmed) {
      if (ch === '{') braceDepth++;
      if (ch === '}') braceDepth--;
    }

    // Emit the line, stripping 'export '
    let emitted = line;
    if (trimmed.startsWith('export ')) {
      emitted = '  ' + trimmed.replace(/^export /, '');
    } else {
      emitted = '  ' + trimmed;
    }
    declLines.push(emitted);

    // End of block
    if (braceDepth <= 0) {
      inExport = false;
      braceDepth = 0;
    }
  }
}

const moduleDecl = `declare module 'kindscript' {\n${declLines.join('\n')}\n}`;

const outPath = path.join(repoRoot, 'apps/website/src/lib/lessons/kindscript-types.ts');
const tsContent = `// AUTO-GENERATED from src/api.ts — do not edit manually.
// Re-generate with: node apps/website/scripts/generate-types.mjs
export const KINDSCRIPT_TYPES = ${JSON.stringify(moduleDecl)};
`;

fs.writeFileSync(outPath, tsContent);
console.log(`KindScript types generated → ${outPath}`);
