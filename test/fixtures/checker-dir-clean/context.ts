// Test fixture: directory value with clean files.
// The checker should produce ZERO diagnostics.

type KSDir<Path extends string = string> = {
  readonly path: Path;
  readonly name: string;
  readonly __ks?: true;
};

type PropertySpec = {
  readonly noImports?: true;
  readonly noConsole?: true;
  readonly immutable?: true;
  readonly noSideEffects?: true;
};

type Kind<
  Base = unknown,
  _Properties extends PropertySpec = {},
> = Base & {
  readonly __ks?: true;
};

type PureDir = Kind<KSDir, { noConsole: true, immutable: true, noSideEffects: true }>;

declare const ks: {
  dir<P extends string>(path: P): KSDir<P>;
};

const pureSrc: PureDir = ks.dir('./src/pure');
