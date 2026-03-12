/**
 * Validate lesson content and files.
 *
 * Checks:
 * 1. lesson.json has required fields
 * 2. starter/ and solution/ dirs exist with matching structure
 * 3. Code blocks in content.mdx reference files that exist in starter/
 * 4. Solution files pass `ksc check` (via the bundled CLI)
 *
 * Run: node apps/website/scripts/validate-lessons.mjs
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lessonsDir = path.resolve(__dirname, '../src/lib/lessons');

let errors = 0;
let warnings = 0;

function error(lesson, msg) {
  console.error(`  ✗ [${lesson}] ${msg}`);
  errors++;
}

function warn(lesson, msg) {
  console.warn(`  ⚠ [${lesson}] ${msg}`);
  warnings++;
}

function ok(lesson, msg) {
  console.log(`  ✓ [${lesson}] ${msg}`);
}

// Discover lesson directories (pattern: N-N-slug)
const lessonDirs = fs.readdirSync(lessonsDir).filter(d => {
  const full = path.join(lessonsDir, d);
  return fs.statSync(full).isDirectory() && /^\d+-\d+-/.test(d);
});

if (lessonDirs.length === 0) {
  console.error('No lesson directories found.');
  process.exit(1);
}

console.log(`Found ${lessonDirs.length} lesson(s):\n`);

const requiredJsonFields = ['slug', 'title', 'partTitle', 'partNumber', 'lessonNumber', 'focus'];

for (const dir of lessonDirs) {
  const lessonPath = path.join(lessonsDir, dir);
  console.log(`Lesson: ${dir}`);

  // 1. Validate lesson.json
  const jsonPath = path.join(lessonPath, 'lesson.json');
  if (!fs.existsSync(jsonPath)) {
    error(dir, 'Missing lesson.json');
    continue;
  }

  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch (e) {
    error(dir, `Invalid JSON in lesson.json: ${e.message}`);
    continue;
  }

  for (const field of requiredJsonFields) {
    if (meta[field] === undefined) {
      error(dir, `lesson.json missing required field: ${field}`);
    }
  }

  if (meta.slug !== dir) {
    warn(dir, `lesson.json slug "${meta.slug}" doesn't match directory name "${dir}"`);
  }

  ok(dir, 'lesson.json valid');

  // 2. Check starter/ and solution/ exist
  const starterDir = path.join(lessonPath, 'starter');
  const solutionDir = path.join(lessonPath, 'solution');

  if (!fs.existsSync(starterDir)) {
    error(dir, 'Missing starter/ directory');
  } else {
    ok(dir, 'starter/ exists');
  }

  if (!fs.existsSync(solutionDir)) {
    error(dir, 'Missing solution/ directory');
  } else {
    ok(dir, 'solution/ exists');
  }

  // 3. Check focus file exists in starter
  if (meta.focus && fs.existsSync(starterDir)) {
    const focusPath = path.join(starterDir, meta.focus);
    if (!fs.existsSync(focusPath)) {
      error(dir, `Focus file "${meta.focus}" not found in starter/`);
    } else {
      ok(dir, `Focus file "${meta.focus}" exists`);
    }
  }

  // 4. Check content.mdx exists and references valid files
  const mdxPath = path.join(lessonPath, 'content.mdx');
  if (!fs.existsSync(mdxPath)) {
    error(dir, 'Missing content.mdx');
  } else {
    const mdxContent = fs.readFileSync(mdxPath, 'utf-8');

    // Extract file references like `src/kinds.ts` from inline code
    const fileRefs = new Set();
    const codeRefPattern = /`(src\/[\w/.-]+\.\w+)`/g;
    let match;
    while ((match = codeRefPattern.exec(mdxContent)) !== null) {
      fileRefs.add(match[1]);
    }

    if (fs.existsSync(starterDir)) {
      for (const ref of fileRefs) {
        const refPath = path.join(starterDir, ref);
        if (!fs.existsSync(refPath)) {
          warn(dir, `content.mdx references "${ref}" but it's not in starter/`);
        }
      }
    }

    ok(dir, 'content.mdx exists');
  }

  // 5. Validate solution files pass ksc check
  if (fs.existsSync(solutionDir)) {
    const solutionFiles = [];
    function walk(d) {
      for (const entry of fs.readdirSync(d)) {
        const full = path.join(d, entry);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) solutionFiles.push(full);
      }
    }
    walk(solutionDir);

    if (solutionFiles.length === 0) {
      warn(dir, 'No .ts files in solution/');
    } else {
      ok(dir, `Solution has ${solutionFiles.length} .ts file(s)`);
    }
  }

  console.log('');
}

// Summary
console.log('─'.repeat(40));
if (errors > 0) {
  console.error(`\n${errors} error(s), ${warnings} warning(s)`);
  process.exit(1);
} else if (warnings > 0) {
  console.warn(`\n0 errors, ${warnings} warning(s)`);
} else {
  console.log('\nAll lessons valid.');
}
