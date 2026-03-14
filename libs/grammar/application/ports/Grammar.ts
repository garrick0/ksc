import type { FieldDef } from './FieldDef.js';

/** A grammar's complete runtime metadata — the consumer-facing interface. */
export interface Grammar<K extends string = string> {
  readonly fieldDefs: Readonly<Record<string, readonly FieldDef[]>>;
  readonly allKinds: ReadonlySet<K>;
  readonly fileContainerKind: K;
  readonly fileNameField: string;
  readonly sumTypeMembers: Readonly<Record<string, readonly string[]>>;
  readonly sumTypeMembership: Readonly<Record<string, readonly string[]>>;
}
