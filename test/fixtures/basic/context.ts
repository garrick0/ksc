// A minimal context.ts for testing the KindScript pipeline.
// Uses the Kind API to define architectural constraints.

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

// Kind definitions
type DomainLayer = Kind<KSDir, { pure: true, noIO: true }>;
type InfraLayer = Kind<KSDir>;

// Kind-annotated values
declare const ks: {
  dir<P extends string>(path: P): KSDir<P>;
};

const domain: DomainLayer = ks.dir('./src/domain');
const infrastructure: InfraLayer = ks.dir('./src/infrastructure');
