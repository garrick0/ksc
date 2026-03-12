/**
 * Utility for comparing normalised violations between ESLint and KindScript.
 */

import type { NormalisedViolation } from './types.js';

/** Sort violations by file, then line, then column for stable comparison. */
export function sortViolations(vs: NormalisedViolation[]): NormalisedViolation[] {
  return [...vs].sort((a, b) =>
    a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column,
  );
}
