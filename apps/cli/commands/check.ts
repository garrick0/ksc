/**
 * CLI command: ksc check — run kind-checking analysis on a TypeScript project.
 *
 * This module acts as the Bridge: it receives ParsedArgs from the Shell (harness),
 * pulls wired singletons from Setup (wiring), and executes the Check use case.
 */

import type { ParsedArgs } from '../harness/args.js';
import { checkProject } from 'ksc/ts-kind-checking';
import { EXIT_SUCCESS, EXIT_VIOLATIONS, EXIT_ERROR } from '../harness/errors.js';
import { formatCheckJSON, formatCheckText } from '../harness/format.js';

/**
 * Command handler: check
 * Wires dependencies and executes the project check.
 */
export async function checkCommand(opts: ParsedArgs): Promise<number> {
  const result = await checkProject(opts.rootDir, {
    configPath: opts.configPath,
    depth: opts.depth,
  });

  if (result.fileCount === 0) {
    console.error('Error: No TypeScript files found.');
    console.error(`  Searched: ${opts.rootDir}`);
    console.error('  Hint: KSC looks for .ts files in libs/ (source) first, then the project root.');
    console.error('  Make sure your project has TypeScript source files, or use --config to specify paths.');
    return EXIT_ERROR;
  }

  console.log(opts.json ? formatCheckJSON(result) : formatCheckText(result));
  return result.diagnostics.length > 0 ? EXIT_VIOLATIONS : EXIT_SUCCESS;
}
