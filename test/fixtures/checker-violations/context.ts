// Test fixture: values that VIOLATE their declared properties.
// The checker should produce diagnostics for each violation.

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
  readonly maxFanOut?: number;
};

type Kind<
  Base = unknown,
  _Properties extends PropertySpec = {},
> = Base & {
  readonly __ks?: true;
};

declare const ks: {
  file<P extends string>(path: P): KSFile<P>;
  dir<P extends string>(path: P): KSDir<P>;
};

// ── noConsole violation ──
// Function body uses console.log
const noConsoleFunc: Kind<() => void, { noConsole: true }> =
  () => {
    console.log('hello');
  };

// ── noMutation violation ──
// Function body contains assignment and increment
const noMutationFunc: Kind<(arr: number[]) => void, { noMutation: true }> =
  (arr) => {
    let x = 0;
    x = 1;
    x++;
  };

// ── noImports violation (on directory — checked via src/domain files) ──
type NoImportsLayer = Kind<KSDir, { noImports: true }>;
const domainDir: NoImportsLayer = ks.dir('./src/domain');

// ── noIO violation (on directory — checked via src/infra files) ──
type NoIOLayer = Kind<KSDir, { noIO: true }>;
const infraDir: NoIOLayer = ks.dir('./src/infra');
