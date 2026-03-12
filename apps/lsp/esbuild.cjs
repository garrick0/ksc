/**
 * Build script — bundles the KindScript VS Code extension.
 *
 * Produces two bundles:
 *   dist/server.cjs    — language server (Node.js process)
 *   dist/extension.cjs — VS Code extension client
 */

const esbuild = require('esbuild');
const production = process.argv.includes('--production');

async function build() {
  const commonOptions = {
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    minify: production,
    sourcemap: !production,
    logLevel: 'info',
  };

  // Bundle server (shebang for `npx kindscript-lsp --stdio` usage)
  await esbuild.build({
    ...commonOptions,
    entryPoints: ['server/server.ts'],
    outfile: 'dist/server.cjs',
    external: [],
    banner: { js: '#!/usr/bin/env node' },
  });

  // Bundle client (vscode is provided at runtime by VS Code)
  await esbuild.build({
    ...commonOptions,
    entryPoints: ['client/extension.ts'],
    outfile: 'dist/extension.cjs',
    external: ['vscode'],
  });
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
