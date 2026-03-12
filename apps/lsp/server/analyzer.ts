/**
 * KindScript analysis wrapper for the LSP server.
 *
 * Bridges the TS LanguageService to the KindScript pipeline:
 *   ts.LanguageService.getProgram() → createProgramFromTSProgram() → diagnostics
 *
 * Works purely with KindScript types — no LSP types imported here.
 * The server module handles KS→LSP diagnostic conversion.
 */

import ts from 'typescript';
import type { Diagnostic } from '../../../src/adapters/analysis/spec/ts-kind-checking/types.js';
import type { KindScriptConfig } from '../../../src/application/types.js';
import type { KSProgramInterface } from '../../../src/application/types.js';
import { createProgramFromTSProgram as _createProgramFromTSProgram } from '../../../src/application/check-program.js';
import { evaluator, tsToAstTranslatorAdapter, depGraph } from '../../../src/application/evaluation/ts-kind-checking.js';
import type { KSCAttrMap, KSCProjections } from '../../../src/adapters/analysis/spec/ts-kind-checking/index.js';
import type { CheckDeps } from '../../../src/application/types.js';

const checkDeps: CheckDeps<KSCAttrMap, KSCProjections> = {
  evaluator,
  translator: tsToAstTranslatorAdapter,
  depGraph,
};

/** Logger interface so the analyzer can report errors without depending on LSP. */
export interface AnalyzerLogger {
  error(message: string): void;
}

export class Analyzer {
  private config: KindScriptConfig = {};
  private lastDiagnostics = new Map<string, Diagnostic[]>();
  private logger?: AnalyzerLogger;

  constructor(logger?: AnalyzerLogger) {
    this.logger = logger;
  }

  /** Update the KindScript config (e.g., when ksc.config.ts changes). */
  updateConfig(config: KindScriptConfig): void {
    this.config = config;
  }

  /**
   * Run full KindScript analysis using the current TS program.
   *
   * Returns diagnostics grouped by file name.
   */
  analyze(languageService: ts.LanguageService): Map<string, Diagnostic[]> {
    const tsProgram = languageService.getProgram();
    if (!tsProgram) {
      return this.lastDiagnostics;
    }

    let ksProgram: KSProgramInterface;
    try {
      ksProgram = _createProgramFromTSProgram(checkDeps, tsProgram, this.config);
    } catch (err) {
      // If analysis fails, keep last good diagnostics and log the error
      const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
      this.logger?.error(`[kindscript] Analysis failed: ${detail}`);
      return this.lastDiagnostics;
    }

    const allDiags = ksProgram.getDiagnostics();

    // Group by file
    const byFile = new Map<string, Diagnostic[]>();
    for (const diag of allDiags) {
      const file = diag.fileName;
      if (!byFile.has(file)) byFile.set(file, []);
      byFile.get(file)!.push(diag);
    }

    // Ensure files that had diagnostics before but now have none get an empty array
    for (const prevFile of this.lastDiagnostics.keys()) {
      if (!byFile.has(prevFile)) {
        byFile.set(prevFile, []);
      }
    }

    this.lastDiagnostics = byFile;
    return byFile;
  }

  /** Get the last computed diagnostics (without re-analyzing). */
  getLastDiagnostics(): Map<string, Diagnostic[]> {
    return this.lastDiagnostics;
  }
}
