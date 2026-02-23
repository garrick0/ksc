// Test fixture: type alias chains (Kind defined through intermediate aliases).

type KSDir<Path extends string = string> = {
  readonly path: Path;
  readonly name: string;
  readonly __ks?: true;
};

type PropertySpec = {
  readonly pure?: true;
  readonly noIO?: true;
  readonly noImports?: true;
};

type Kind<
  Base = unknown,
  _Properties extends PropertySpec = {},
> = Base & {
  readonly __ks?: true;
};

// Original Kind definition
type PureDomain = Kind<KSDir, { pure: true, noIO: true }>;

// Alias chain: MyDomain → PureDomain → Kind<KSDir, { pure: true, noIO: true }>
type MyDomain = PureDomain;

// Value annotated with the alias
declare const ks: {
  dir<P extends string>(path: P): KSDir<P>;
};

const domain: MyDomain = ks.dir('./src/domain');
