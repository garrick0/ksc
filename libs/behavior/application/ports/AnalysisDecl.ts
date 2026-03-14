import type { AttrDecl } from './AttrDecl.js';

/** Import path options passed to typeImports callbacks. */
export interface ImportPaths {
  specImportPath: string;
}

/**
 * What an analysis declares for code generation.
 */
export interface AnalysisDecl<K extends string = string> {
  /** All attributes — spec provides the complete list (no automatic derivation). */
  attrs: AttrDecl<K>[];
  /** Type import lines for generated files (domain types like KindDefinition, Diagnostic). */
  typeImports?: (paths: ImportPaths) => string[];
}
