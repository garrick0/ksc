/**
 * CLI command: ksc init — generate a ksc.config.ts scaffold.
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import type { ParsedArgs } from '../args.js';
import { EXIT_SUCCESS, EXIT_ERROR } from '../errors.js';

export function initCommand(opts: ParsedArgs): number {
  const configName = 'ksc.config.ts';
  const configPath = path.join(opts.rootDir, configName);

  if (fs.existsSync(configPath)) {
    console.error(`Error: ${configName} already exists.`);
    return EXIT_ERROR;
  }

  const template = `import { defineConfig } from 'kindscript';

export default defineConfig({
  analysisDepth: 'check',
});
`;

  fs.writeFileSync(configPath, template, 'utf-8');
  console.log(`Created ${configName}`);
  return EXIT_SUCCESS;
}
