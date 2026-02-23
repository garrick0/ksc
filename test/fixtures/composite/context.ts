// Test fixture: composite kinds with relational constraints.

type KSDir<Path extends string = string> = {
  readonly path: Path;
  readonly name: string;
  readonly __ks?: true;
};

type PropertySpec<Members = {}> = {
  readonly pure?: true;
  readonly noIO?: true;
  readonly noImports?: true;
  readonly noConsole?: true;
  readonly noDependency?: ReadonlyArray<
    readonly [keyof Members & string, keyof Members & string]
  >;
  readonly noCycles?: ReadonlyArray<keyof Members & string>;
};

type Kind<
  Base = unknown,
  _Properties extends PropertySpec<
    Base extends Record<string, unknown> ? Base : {}
  > = {},
> = Base & {
  readonly __ks?: true;
};

// Layer kinds
type DomainLayer = Kind<KSDir, { pure: true, noIO: true }>;
type InfraLayer = Kind<KSDir>;
type AppLayer = Kind<KSDir, { noConsole: true }>;

// Composite kind with relational constraints
type CleanArch = Kind<{
  domain: DomainLayer;
  infrastructure: InfraLayer;
  application: AppLayer;
}, {
  noDependency: [["domain", "infrastructure"], ["domain", "application"]],
  noCycles: ["domain", "infrastructure", "application"],
}>;

// Kind-annotated values
declare const ks: {
  dir<P extends string>(path: P): KSDir<P>;
};

const app: CleanArch = {
  domain: ks.dir('./src/domain'),
  infrastructure: ks.dir('./src/infrastructure'),
  application: ks.dir('./src/application'),
};
