// Test fixture: inline kinds (Kind<...> used directly as type annotation).

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
  readonly scope?: 'folder' | 'file';
};

type Kind<
  Base = unknown,
  _Properties extends PropertySpec = {},
> = Base & {
  readonly __ks?: true;
};

// Inline kind annotations — no separate type alias
declare const ks: {
  file<P extends string>(path: P): KSFile<P>;
  dir<P extends string>(path: P): KSDir<P>;
};

const config: Kind<KSDir, { immutable: true, static: true }> =
  ks.dir('./src/config');

const handler: Kind<(req: Request) => Response, { noIO: true }> =
  (req) => new Response(req.url);

const utils: Kind<KSFile, { pure: true, noSideEffects: true }> =
  ks.file('./src/utils.ts');

const maxFanOutDir: Kind<KSDir, { maxFanOut: 5 }> =
  ks.dir('./src/controllers');

const scopedDir: Kind<KSDir, { scope: 'folder' }> =
  ks.dir('./src/modules');
