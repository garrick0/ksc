/**
 * Foundation Types — System-wide primitives and state enums.
 *
 * This package serves as the foundational layer for the platform,
 * containing types that describe data as it flows through the system.
 */

/** How much TS analysis to perform during conversion. */
export type AnalysisDepth = 'parse' | 'bind' | 'check';

/** Valid AnalysisDepth values. */
const VALID_DEPTHS: readonly AnalysisDepth[] = ['parse', 'bind', 'check'];

/** Type guard for AnalysisDepth. */
export function isAnalysisDepth(value: unknown): value is AnalysisDepth {
  return typeof value === 'string' && VALID_DEPTHS.includes(value as AnalysisDepth);
}

/** Parse a string as AnalysisDepth, throwing a descriptive error on invalid input. */
export function parseAnalysisDepth(value: string): AnalysisDepth {
  if (isAnalysisDepth(value)) return value;
  throw new Error(`Invalid analysisDepth '${value}'. Must be 'parse', 'bind', or 'check'.`);
}
