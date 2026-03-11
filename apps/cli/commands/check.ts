/**
 * CLI command: ksc check — run kind-checking analysis on a TypeScript project.
 */

import type { ParsedArgs } from '../args.js';
import { EXIT_SUCCESS, EXIT_VIOLATIONS, EXIT_ERROR } from '../errors.js';
import { checkProject } from '../../../src/application/index.js';
import { formatCheckJSON, formatCheckText } from '../format.js';

export async function checkCommand(opts: ParsedArgs): Promise<number> {
  const result = await checkProject(opts.rootDir, {
    configPath: opts.configPath,
    depth: opts.depth,
  });

  if (result.fileCount === 0) {
    console.error('Error: No TypeScript files found.');
    console.error(`  Searched: ${opts.rootDir}`);
    console.error('  Hint: KSC looks for .ts files in src/ first, then the project root.');
    console.error('  Make sure your project has TypeScript source files, or use --config to specify paths.');
    return EXIT_ERROR;
  }

  console.log(opts.json ? formatCheckJSON(result) : formatCheckText(result));
  return result.diagnostics.length > 0 ? EXIT_VIOLATIONS : EXIT_SUCCESS;
}
