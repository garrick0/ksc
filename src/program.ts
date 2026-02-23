/**
 * The KindScript Program object.
 *
 * Top-level coordinator that creates the TypeScript program (delegating
 * scan/parse/bind to TS), runs the KindScript binder on the config,
 * and lazily creates the checker.
 */

import ts from 'typescript';
import type { KSProgram, KSChecker, KSDiagnostic, KindSymbol } from './types.js';
import type { KindScriptConfig } from './config.js';
import { ksBind } from './binder.js';
import { createKSChecker } from './checker.js';

/**
 * Create a KindScript program from root file names, a config, and
 * compiler options.
 *
 * This is the primary entry point. It delegates to ts.createProgram()
 * for scanning, parsing, and TypeScript binding, then runs the
 * KindScript binder to convert config entries into KindSymbols.
 *
 * The checker is created lazily on first access.
 */
export function createProgram(
  rootNames: string[],
  config: KindScriptConfig,
  options?: ts.CompilerOptions,
): KSProgram {
  const tsProgram = ts.createProgram(rootNames, options ?? {});
  return createProgramFromTSProgram(tsProgram, config);
}

/**
 * Create a KindScript program from an existing ts.Program and config.
 *
 * Used by the language service plugin, which receives an already-created
 * ts.Program and wraps it rather than creating a new one.
 */
export function createProgramFromTSProgram(
  tsProgram: ts.Program,
  config: KindScriptConfig,
): KSProgram {
  const binderResult = ksBind(config);
  const allSymbols = binderResult.symbols;
  const targets = binderResult.targets;

  let checker: KSChecker | undefined;

  return {
    getTSProgram: () => tsProgram,
    getSourceFiles: () => tsProgram.getSourceFiles(),
    getCompilerOptions: () => tsProgram.getCompilerOptions(),
    getTSTypeChecker: () => tsProgram.getTypeChecker(),
    getAllKindSymbols: () => allSymbols,
    getKindChecker: () => {
      if (!checker) {
        checker = createKSChecker(tsProgram, targets);
      }
      return checker;
    },
    getKindDiagnostics: (sf?: ts.SourceFile) => {
      const c = (checker ??= createKSChecker(tsProgram, targets));
      return sf ? c.checkSourceFile(sf) : c.checkProgram();
    },
  };
}
