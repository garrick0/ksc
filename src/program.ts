/**
 * The KindScript Program object.
 *
 * Top-level coordinator that creates the TypeScript program (delegating
 * scan/parse/bind to TS), runs the KindScript binder, and lazily creates
 * the checker.
 *
 * Mirrors ts.Program in structure and lifecycle.
 */

import ts from 'typescript';
import type { KSProgram, KSChecker, KSDiagnostic, KindSymbolTable } from './types.js';
import { ksBind } from './binder.js';
import { createKSChecker } from './checker.js';

/**
 * Create a KindScript program from root file names and compiler options.
 *
 * This is the primary entry point. It delegates to ts.createProgram()
 * for scanning, parsing, and TypeScript binding, then runs the KindScript
 * binder to build the KindSymbolTable.
 *
 * The checker is created lazily on first access.
 */
export function createProgram(
  rootNames: string[],
  options?: ts.CompilerOptions,
): KSProgram {
  // 1. Create the TypeScript program (scan, parse, bind happen here)
  const tsProgram = ts.createProgram(rootNames, options ?? {});

  // 2. Build the KSProgram wrapper
  return createProgramFromTSProgram(tsProgram);
}

/**
 * Create a KindScript program from an existing ts.Program.
 *
 * Used by the language service plugin, which receives an already-created
 * ts.Program and wraps it rather than creating a new one.
 */
export function createProgramFromTSProgram(tsProgram: ts.Program): KSProgram {
  // Run the KindScript binder
  const kindSymbolTable = ksBind(tsProgram);

  // Checker is lazy — only created when someone requests it
  let checker: KSChecker | undefined;

  return {
    getTSProgram: () => tsProgram,
    getSourceFiles: () => tsProgram.getSourceFiles(),
    getCompilerOptions: () => tsProgram.getCompilerOptions(),
    getTSTypeChecker: () => tsProgram.getTypeChecker(),
    getKindSymbolTable: () => kindSymbolTable,
    getKindChecker: () => {
      if (!checker) {
        checker = createKSChecker(tsProgram, kindSymbolTable);
      }
      return checker;
    },
    getKindDiagnostics: (sf?: ts.SourceFile) => {
      const c = (checker ??= createKSChecker(tsProgram, kindSymbolTable));
      return sf ? c.checkSourceFile(sf) : c.checkProgram();
    },
  };
}
