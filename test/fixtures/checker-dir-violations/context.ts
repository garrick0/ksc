// Test fixture: directory value with files that violate constraints.

type KSDir<Path extends string = string> = {
  readonly path: Path;
  readonly name: string;
  readonly __ks?: true;
};

type PropertySpec = {
  readonly noConsole?: true;
  readonly immutable?: true;
  readonly noSideEffects?: true;
  readonly static?: true;
};

type Kind<
  Base = unknown,
  _Properties extends PropertySpec = {},
> = Base & {
  readonly __ks?: true;
};

type StrictDir = Kind<KSDir, {
  noConsole: true,
  immutable: true,
  noSideEffects: true,
  static: true,
}>;

declare const ks: {
  dir<P extends string>(path: P): KSDir<P>;
};

const impureDir: StrictDir = ks.dir('./src/impure');
