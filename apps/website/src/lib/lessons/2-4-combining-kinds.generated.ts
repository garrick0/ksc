// Auto-generated from 2-4-combining-kinds/
// DO NOT EDIT — regenerate with: npm run generate:lessons

import { Lesson } from './types';

export const lesson: Lesson = {
  "slug": "2-4-combining-kinds",
  "title": "Combining Kinds",
  "partTitle": "Detecting Code Issues",
  "partNumber": 2,
  "lessonNumber": 4,
  "focus": "src/service.ts",
  "files": [
    {
      "path": "src/kinds.ts",
      "contents": "export interface PropertySet {\n  readonly noImports?: true;\n  readonly noConsole?: true;\n  readonly immutable?: true;\n  readonly static?: true;\n  readonly noSideEffects?: true;\n  readonly noMutation?: true;\n  readonly noIO?: true;\n  readonly pure?: true;\n}\n\nexport type Kind<R extends PropertySet> = { readonly __kind?: R };\n\nexport type Immutable = Kind<{ immutable: true }>;\nexport type NoConsole = Kind<{ noConsole: true }>;\nexport type StrictValue = Kind<{ immutable: true; noConsole: true; noMutation: true }>;\n"
    },
    {
      "path": "src/service.ts",
      "contents": "import type { StrictValue } from './kinds';\n\n// A configuration service where values must be immutable, console-free, and mutation-free.\n// Run `npm run check` to find the violations.\n\nexport const buildEndpoint: StrictValue & ((base: string, path: string) => string) = (base, path) => {\n  let url = `${base}/${path}`;\n  console.log(`Building endpoint: ${url}`);\n  return url;\n};\n\nexport const buildHeaders: StrictValue & ((token: string) => Record<string, string>) = (token) => {\n  const headers: Record<string, string> = {};\n  headers['Authorization'] = `Bearer ${token}`;\n  headers['Content-Type'] = 'application/json';\n  return headers;\n};\n"
    },
  ],
  "solution": [
    {
      "path": "src/kinds.ts",
      "contents": "export interface PropertySet {\n  readonly noImports?: true;\n  readonly noConsole?: true;\n  readonly immutable?: true;\n  readonly static?: true;\n  readonly noSideEffects?: true;\n  readonly noMutation?: true;\n  readonly noIO?: true;\n  readonly pure?: true;\n}\n\nexport type Kind<R extends PropertySet> = { readonly __kind?: R };\n\nexport type Immutable = Kind<{ immutable: true }>;\nexport type NoConsole = Kind<{ noConsole: true }>;\nexport type StrictValue = Kind<{ immutable: true; noConsole: true; noMutation: true }>;\n"
    },
    {
      "path": "src/service.ts",
      "contents": "import type { StrictValue } from './kinds';\n\n// A configuration service — immutable, console-free, and mutation-free.\n\nexport const buildEndpoint: StrictValue & ((base: string, path: string) => string) = (base, path) => {\n  const url = `${base}/${path}`;\n  return url;\n};\n\nexport const buildHeaders: StrictValue & ((token: string) => Record<string, string>) = (token) => {\n  return {\n    'Authorization': `Bearer ${token}`,\n    'Content-Type': 'application/json',\n  };\n};\n"
    },
  ]
};
