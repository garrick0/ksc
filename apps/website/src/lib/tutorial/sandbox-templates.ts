import { LessonFile } from '@/lib/lessons/types';

export interface SandboxTemplate {
  id: string;
  name: string;
  description: string;
  files: LessonFile[];
}

export const SANDBOX_TEMPLATES: SandboxTemplate[] = [
  {
    id: 'property-kinds',
    name: 'Property Kinds',
    description: 'Define kinds with properties like noImports, noConsole, immutable',
    files: [
      {
        path: 'src/kinds.ts',
        contents: `export interface PropertySet {
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

export type NoImports = Kind<{ noImports: true }>;
export type NoConsole = Kind<{ noConsole: true }>;
export type Immutable = Kind<{ immutable: true }>;
export type Pure = Kind<{ pure: true }>;
`,
      },
      {
        path: 'src/math.ts',
        contents: `import type { NoImports } from './kinds';

export const add: NoImports & ((a: number, b: number) => number) = (a, b) => a + b;

export const multiply: NoImports & ((a: number, b: number) => number) = (a, b) => a * b;
`,
      },
      {
        path: 'src/helpers.ts',
        contents: `export function helper(x: number): number {
  return x * 2;
}
`,
      },
    ],
  },
  {
    id: 'blank',
    name: 'Blank Project',
    description: 'Empty project — start from scratch',
    files: [
      {
        path: 'src/kinds.ts',
        contents: `// Define your PropertySet and Kind types here
`,
      },
    ],
  },
];
