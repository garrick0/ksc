/** Field metadata for child/optChild/list fields — references a child node kind. */
export type ChildFieldDef = {
  name: string;
  tag: 'child' | 'optChild' | 'list';
  typeRef?: string;
};

/** Field metadata for prop fields — carries a property type string and optional default. */
export type PropFieldDef = {
  name: string;
  tag: 'prop';
  propType: string;
  default?: unknown;
};

/** Field metadata — canonical definition used by schema-utils and evaluators. */
export type FieldDef = ChildFieldDef | PropFieldDef;
