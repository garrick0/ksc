import { FileSystemTree } from '@webcontainer/api';
import { CLI_BUNDLE } from './cli-bundle';

export const templateFiles: FileSystemTree = {
  'package.json': {
    file: {
      contents: JSON.stringify(
        {
          name: 'kindscript-lesson',
          version: '1.0.0',
          type: 'module',
          scripts: {
            check: 'node ksc-check.mjs .',
          },
          dependencies: {
            typescript: '~5.5.0',
          },
        },
        null,
        2
      ),
    },
  },
  'ksc-check.mjs': {
    file: {
      contents: CLI_BUNDLE,
    },
  },
  'tsconfig.json': {
    file: {
      contents: JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2020',
            module: 'NodeNext',
            lib: ['ES2020'],
            moduleResolution: 'nodenext',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
          },
          include: ['src/**/*'],
        },
        null,
        2
      ),
    },
  },
};
