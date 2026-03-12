// Auto-generated from 1-1-hello-world/
// DO NOT EDIT — regenerate with: npm run generate:lessons

import { Lesson } from './types';

export const lesson: Lesson = {
  "slug": "1-1-hello-world",
  "title": "Hello KindScript",
  "partTitle": "Getting Started",
  "partNumber": 1,
  "lessonNumber": 1,
  "focus": "src/kinds.ts",
  "files": [
    {
      "path": "src/helpers.ts",
      "contents": "export function helper(x: number): number {\n  return x * 2;\n}\n"
    },
    {
      "path": "src/kinds.ts",
      "contents": "export interface PropertySet {\n  readonly noImports?: true;\n  readonly noConsole?: true;\n  readonly immutable?: true;\n  readonly static?: true;\n  readonly noSideEffects?: true;\n  readonly noMutation?: true;\n  readonly noIO?: true;\n  readonly pure?: true;\n}\n\nexport type Kind<R extends PropertySet> = { readonly __kind?: R };\n\nexport type NoImports = Kind<{ noImports: true }>;\n"
    },
    {
      "path": "src/math.ts",
      "contents": "import type { NoImports } from './kinds';\n\nexport const add: NoImports & ((a: number, b: number) => number) = (a, b) => a + b;\n\nexport const multiply: NoImports & ((a: number, b: number) => number) = (a, b) => a * b;\n"
    },
  ],
  "solution": [
    {
      "path": "src/helpers.ts",
      "contents": "export function helper(x: number): number {\n  return x * 2;\n}\n"
    },
    {
      "path": "src/kinds.ts",
      "contents": "export interface PropertySet {\n  readonly noImports?: true;\n  readonly noConsole?: true;\n  readonly immutable?: true;\n  readonly static?: true;\n  readonly noSideEffects?: true;\n  readonly noMutation?: true;\n  readonly noIO?: true;\n  readonly pure?: true;\n}\n\nexport type Kind<R extends PropertySet> = { readonly __kind?: R };\n\nexport type NoImports = Kind<{ noImports: true }>;\n"
    },
    {
      "path": "src/math.ts",
      "contents": "import type { NoImports } from './kinds';\n\nexport const add: NoImports & ((a: number, b: number) => number) = (a, b) => a + b;\n\nexport const multiply: NoImports & ((a: number, b: number) => number) = (a, b) => a * b;\n"
    },
  ]
};
