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
export type NoMutation = Kind<{ noMutation: true }>;
export type Immutable = Kind<{ immutable: true }>;
export type Pure = Kind<{ noImports: true; noConsole: true; noMutation: true; immutable: true }>;
