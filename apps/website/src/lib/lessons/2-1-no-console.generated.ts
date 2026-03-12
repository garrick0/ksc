// Auto-generated from 2-1-no-console/
// DO NOT EDIT — regenerate with: npm run generate:lessons

import { Lesson } from './types';

export const lesson: Lesson = {
  "slug": "2-1-no-console",
  "title": "No Console",
  "partTitle": "Detecting Code Issues",
  "partNumber": 2,
  "lessonNumber": 1,
  "focus": "src/logger.ts",
  "files": [
    {
      "path": "src/kinds.ts",
      "contents": "export interface PropertySet {\n  readonly noImports?: true;\n  readonly noConsole?: true;\n  readonly immutable?: true;\n  readonly static?: true;\n  readonly noSideEffects?: true;\n  readonly noMutation?: true;\n  readonly noIO?: true;\n  readonly pure?: true;\n}\n\nexport type Kind<R extends PropertySet> = { readonly __kind?: R };\n\nexport type NoConsole = Kind<{ noConsole: true }>;\n"
    },
    {
      "path": "src/logger.ts",
      "contents": "import type { NoConsole } from './kinds';\n\n// These formatters should produce structured strings without console side effects.\n// Run `npm run check` to find the violations.\n\nexport const formatMessage: NoConsole & ((level: string, msg: string) => string) = (level, msg) => {\n  console.log(`Formatting: ${msg}`);\n  return `[${level.toUpperCase()}] ${msg}`;\n};\n\nexport const formatError: NoConsole & ((err: string, code: number) => string) = (err, code) => {\n  console.error(`Error ${code}: ${err}`);\n  return `ERROR-${code}: ${err}`;\n};\n\nexport const formatWarning: NoConsole & ((msg: string) => string) = (msg) => {\n  console.warn(`Warning: ${msg}`);\n  return `WARN: ${msg}`;\n};\n"
    },
  ],
  "solution": [
    {
      "path": "src/kinds.ts",
      "contents": "export interface PropertySet {\n  readonly noImports?: true;\n  readonly noConsole?: true;\n  readonly immutable?: true;\n  readonly static?: true;\n  readonly noSideEffects?: true;\n  readonly noMutation?: true;\n  readonly noIO?: true;\n  readonly pure?: true;\n}\n\nexport type Kind<R extends PropertySet> = { readonly __kind?: R };\n\nexport type NoConsole = Kind<{ noConsole: true }>;\n"
    },
    {
      "path": "src/logger.ts",
      "contents": "import type { NoConsole } from './kinds';\n\n// These formatters produce structured strings without console side effects.\n\nexport const formatMessage: NoConsole & ((level: string, msg: string) => string) = (level, msg) => {\n  return `[${level.toUpperCase()}] ${msg}`;\n};\n\nexport const formatError: NoConsole & ((err: string, code: number) => string) = (err, code) => {\n  return `ERROR-${code}: ${err}`;\n};\n\nexport const formatWarning: NoConsole & ((msg: string) => string) = (msg) => {\n  return `WARN: ${msg}`;\n};\n"
    },
  ]
};
