/**
 * Kind-checking vocabulary types.
 *
 * All domain types specific to the kind-checking analysis:
 *   KindDefinition — a kind definition found in source code
 *   Diagnostic — a violation diagnostic
 *   DefIdCounter — unique ID generator for kind definitions
 *   PropertySet — the vocabulary of checkable properties
 *   Kind<R> — phantom type for source annotations
 *   PROPERTY_KEYS — runtime property name validation
 */

// ── Kind Definitions ──

/**
 * A kind definition found in source code.
 * Produced from `type X = Kind<{ ... }>` declarations.
 */
export interface KindDefinition {
  /** Unique identifier (e.g., "kdef-0"). */
  id: string;
  /** The type alias name (e.g., "Pure"). */
  name: string;
  /** The properties extracted from the Kind<...> type argument. */
  properties: Record<string, boolean | undefined>;
  /** The AST node for this definition. */
  node: unknown;
}

// ── Checker Diagnostics ──

/**
 * A diagnostic produced by the checker when a kind property is violated.
 */
export interface Diagnostic {
  /** The AST node where the violation occurs. */
  node: unknown;
  /** Human-readable description. */
  message: string;
  /** Name of the kind that was violated. */
  kindName: string;
  /** The specific property that was violated. */
  property: string;
  /** Position info. */
  pos: number;
  end: number;
  fileName: string;
}

// ── DefIdCounter ──

/** Mutable counter for generating unique definition IDs. */
export interface DefIdCounter { value: number }

// ── Property Vocabulary ──

/** The vocabulary of properties a kind can declare. */
export interface PropertySet {
  readonly noImports?: true;
  readonly noConsole?: true;
  readonly immutable?: true;
  readonly static?: true;
  readonly noSideEffects?: true;
  readonly noMutation?: true;
  readonly noIO?: true;
  readonly pure?: true;
}

/**
 * A phantom type that carries property information.
 *
 * Define a kind:
 *   type NoImports = Kind<{ noImports: true }>;
 *
 * Annotate a value:
 *   const add: NoImports & ((a: number, b: number) => number) = (a, b) => a + b;
 */
export type Kind<R extends PropertySet> = { readonly __kind?: R };

/** Derive PROPERTY_KEYS from PropertySet at the type level. */
export const PROPERTY_KEYS: ReadonlySet<string> = new Set<keyof PropertySet>([
  'noImports', 'noConsole', 'immutable', 'static',
  'noSideEffects', 'noMutation', 'noIO', 'pure',
]);
