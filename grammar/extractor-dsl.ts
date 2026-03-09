/**
 * Type-safe expression builders for field extractors.
 *
 * Provides compile-time validation that extractor expressions reference
 * known helper functions and map names, replacing runtime-only validation
 * with TypeScript type checking.
 */

/**
 * Create expression builders for stateful helper function calls.
 * Each builder auto-prepends the context variable as the first argument.
 */
export function statefulCallBuilders<const T extends readonly string[]>(
  names: T,
  contextVar = '_ctx',
): Record<T[number], (...args: string[]) => string> {
  const result = {} as Record<string, (...args: string[]) => string>;
  for (const name of names) {
    result[name] = (...args: string[]) => `${name}(${contextVar}, ${args.join(', ')})`;
  }
  return result as Record<T[number], (...args: string[]) => string>;
}

/**
 * Create expression builders for pure helper function calls.
 * No context variable is prepended.
 */
export function pureCallBuilders<const T extends readonly string[]>(
  names: T,
): Record<T[number], (...args: string[]) => string> {
  const result = {} as Record<string, (...args: string[]) => string>;
  for (const name of names) {
    result[name] = (...args: string[]) => `${name}(${args.join(', ')})`;
  }
  return result as Record<T[number], (...args: string[]) => string>;
}

/**
 * Create expression builders for map/record lookups.
 * Each builder produces a bracket-access expression string.
 */
export function mapLookupBuilders<const T extends readonly string[]>(
  names: T,
): Record<T[number], (key: string) => string> {
  const result = {} as Record<string, (key: string) => string>;
  for (const name of names) {
    result[name] = (key: string) => `${name}[${key}]`;
  }
  return result as Record<T[number], (key: string) => string>;
}
