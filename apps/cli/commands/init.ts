/**
 * CLI command: ksc init — generate a ksc.config.ts scaffold.
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import type { ParsedArgs } from '../harness/args.js';
import { EXIT_SUCCESS, EXIT_ERROR } from '../harness/errors.js';

export function initCommand(opts: ParsedArgs): number {
  const configName = 'ksc.config.ts';
  const configPath = path.join(opts.rootDir, configName);

  if (fs.existsSync(configPath)) {
    console.error(`Error: ${configName} already exists.`);
    return EXIT_ERROR;
  }

  const template = `import { defineConfig } from 'ksc';

export default defineConfig({
  analysisDepth: 'check',
});
`;

  try {
    fs.writeFileSync(configPath, template, 'utf-8');
  } catch (err) {
    console.error(`Error: Could not write ${configName}: ${err instanceof Error ? err.message : err}`);
    return EXIT_ERROR;
  }
  console.log(`Created ${configName}`);
  return EXIT_SUCCESS;
}
