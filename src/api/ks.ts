/**
 * The ks builder object — runtime functions for constructing file and
 * directory values. Used in context.ts files.
 *
 *   import { ks } from 'kindscript';
 *   const domain = ks.dir('./src/domain');
 *   const config = ks.file('./src/config.ts');
 */

import { basename, extname } from 'node:path';
import type { KSFile, KSDir } from './types.js';

export const ks = {
  file<P extends string>(path: P): KSFile<P> {
    return {
      path,
      filename: basename(path),
      extension: extname(path),
    } as KSFile<P>;
  },
  dir<P extends string>(path: P): KSDir<P> {
    return {
      path,
      name: basename(path),
    } as KSDir<P>;
  },
};
