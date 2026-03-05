export interface PropertySet {
  readonly noImports?: true;
}

export type Kind<R extends PropertySet> = { readonly __kind?: R };

export type NoImports = Kind<{ noImports: true }>;
