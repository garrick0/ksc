/**
 * Pivot production-centric overrides into attr-centric format.
 *
 * Production-centric (Silver-style):
 *   { CompilationUnit: { kindDefs: fn }, Identifier: { violationFor: fn } }
 *
 * Attr-centric (what compile.ts expects):
 *   { kindDefs: { CompilationUnit: fn }, violationFor: { Identifier: fn } }
 *
 * Function references are moved (not cloned), so withDeps() metadata
 * (.deps, .name) is preserved through the reshape.
 */

/**
 * Reshape production-centric overrides into attr-centric equation records.
 *
 * @param overrides - Per-kind overrides: { kind: { attrName: eqFn } }
 * @returns Per-attr equation records: { attrName: { kind: eqFn } }
 */
export function pivotToAttrCentric<K extends string>(
  overrides: Partial<Record<K, Record<string, Function>>>,
): Record<string, Partial<Record<K, Function>>> {
  const result: Record<string, Partial<Record<K, Function>>> = {};

  for (const [kind, attrMap] of Object.entries(overrides) as [K, Record<string, Function>][]) {
    for (const [attr, fn] of Object.entries(attrMap as Record<string, Function>)) {
      if (!result[attr]) result[attr] = {};
      (result[attr] as Record<string, Function>)[kind] = fn;
    }
  }

  return result;
}
