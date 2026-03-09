/**
 * Generic field extractor assembly.
 *
 * Assembles field extractor maps from declarative configuration.
 * Specs provide the data (base extractors, kind lists, expressions);
 * this module provides the assembly logic.
 */

export interface FieldExtractorConfig {
  /** Base extractors: maps [nodeKind][fieldName] → expression string. */
  base: Record<string, Record<string, string>>;
  /** Rules that add a field to all kinds in a list. */
  kindRules: Array<{
    kinds: readonly string[];
    fieldName: string;
    expression: string;
  }>;
  /** Auto-add extractors for nodes that have these fields in their schema. */
  autoDetectFields?: Array<{
    fieldName: string;
    expression: string;
  }>;
}

/**
 * Assemble a complete field extractor map from configuration.
 *
 * 1. Copies base extractors
 * 2. Applies kind rules (adds field to each kind in the list)
 * 3. Auto-detects fields present in the node schema
 */
export function assembleFieldExtractors(
  nodes: ReadonlyMap<string, { fields: Record<string, unknown> }>,
  config: FieldExtractorConfig,
): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};

  // 1. Copy base extractors
  for (const [kind, fields] of Object.entries(config.base)) {
    result[kind] = { ...fields };
  }

  // 2. Apply kind rules
  for (const rule of config.kindRules) {
    for (const kind of rule.kinds) {
      if (!result[kind]) result[kind] = {};
      result[kind][rule.fieldName] = rule.expression;
    }
  }

  // 3. Auto-detect fields present in node schema
  if (config.autoDetectFields) {
    for (const [kind, entry] of nodes) {
      for (const auto of config.autoDetectFields) {
        if (auto.fieldName in entry.fields) {
          if (!result[kind]) result[kind] = {};
          if (!result[kind][auto.fieldName]) {
            result[kind][auto.fieldName] = auto.expression;
          }
        }
      }
    }
  }

  return result;
}
