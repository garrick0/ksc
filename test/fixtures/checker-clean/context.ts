// Test fixture: clean values that satisfy all declared properties.
// The checker should produce ZERO diagnostics for this file.

type KSDir<Path extends string = string> = {
  readonly path: Path;
  readonly name: string;
  readonly __ks?: true;
};

type KSFile<Path extends string = string> = {
  readonly path: Path;
  readonly filename: string;
  readonly extension: string;
  readonly __ks?: true;
};

type PropertySpec = {
  readonly pure?: true;
  readonly noIO?: true;
  readonly noImports?: true;
  readonly noConsole?: true;
  readonly immutable?: true;
  readonly static?: true;
  readonly noSideEffects?: true;
  readonly noMutation?: true;
};

type Kind<
  Base = unknown,
  _Properties extends PropertySpec = {},
> = Base & {
  readonly __ks?: true;
};

type PureLayer = Kind<KSDir, { pure: true, noIO: true, noImports: true }>;

declare const ks: {
  file<P extends string>(path: P): KSFile<P>;
  dir<P extends string>(path: P): KSDir<P>;
};

// Clean: all properties satisfied (no code to violate them)
const pureDir: PureLayer = ks.dir('./src/pure');

// Clean function: no mutations, no IO, no console
const pureFunc: Kind<(x: number) => number, { noMutation: true, noConsole: true }> =
  (x) => x * 2;
