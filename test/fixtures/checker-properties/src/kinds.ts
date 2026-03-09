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

export type Kind<R extends PropertySet> = { readonly __kind?: R };

export type NoConsole = Kind<{ noConsole: true }>;
export type Immutable = Kind<{ immutable: true }>;
export type Static = Kind<{ static: true }>;
export type NoSideEffects = Kind<{ noSideEffects: true }>;
export type NoMutation = Kind<{ noMutation: true }>;
export type NoIO = Kind<{ noIO: true }>;
export type Pure = Kind<{ pure: true }>;
export type StrictFunc = Kind<{ noImports: true; noConsole: true; immutable: true; noMutation: true }>;
