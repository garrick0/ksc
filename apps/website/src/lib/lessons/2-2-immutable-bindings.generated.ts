// Auto-generated from 2-2-immutable-bindings/
// DO NOT EDIT — regenerate with: npm run generate:lessons

import { Lesson } from './types';

export const lesson: Lesson = {
  "slug": "2-2-immutable-bindings",
  "title": "Immutable Bindings",
  "partTitle": "Detecting Code Issues",
  "partNumber": 2,
  "lessonNumber": 2,
  "focus": "src/config.ts",
  "files": [
    {
      "path": "src/config.ts",
      "contents": "import type { Immutable } from './kinds';\n\n// These functions should use only const bindings internally.\n// Run `npm run check` to find the violations.\n\nexport const buildGreeting: Immutable & ((name: string, title: string) => string) = (name, title) => {\n  let greeting = `Hello, ${title} ${name}`;\n  let suffix = '!';\n  return greeting + suffix;\n};\n\nexport const formatPrice: Immutable & ((amount: number, currency: string) => string) = (amount, currency) => {\n  let formatted = amount.toFixed(2);\n  let label = `${currency} ${formatted}`;\n  return label;\n};\n\nexport const buildList: Immutable & ((items: string[]) => string) = (items) => {\n  let header = 'Items:';\n  let body = items.join(', ');\n  return `${header} ${body}`;\n};\n"
    },
    {
      "path": "src/kinds.ts",
      "contents": "export interface PropertySet {\n  readonly noImports?: true;\n  readonly noConsole?: true;\n  readonly immutable?: true;\n  readonly static?: true;\n  readonly noSideEffects?: true;\n  readonly noMutation?: true;\n  readonly noIO?: true;\n  readonly pure?: true;\n}\n\nexport type Kind<R extends PropertySet> = { readonly __kind?: R };\n\nexport type Immutable = Kind<{ immutable: true }>;\n"
    },
  ],
  "solution": [
    {
      "path": "src/config.ts",
      "contents": "import type { Immutable } from './kinds';\n\n// These functions use only const bindings internally.\n\nexport const buildGreeting: Immutable & ((name: string, title: string) => string) = (name, title) => {\n  const greeting = `Hello, ${title} ${name}`;\n  const suffix = '!';\n  return greeting + suffix;\n};\n\nexport const formatPrice: Immutable & ((amount: number, currency: string) => string) = (amount, currency) => {\n  const formatted = amount.toFixed(2);\n  const label = `${currency} ${formatted}`;\n  return label;\n};\n\nexport const buildList: Immutable & ((items: string[]) => string) = (items) => {\n  const header = 'Items:';\n  const body = items.join(', ');\n  return `${header} ${body}`;\n};\n"
    },
    {
      "path": "src/kinds.ts",
      "contents": "export interface PropertySet {\n  readonly noImports?: true;\n  readonly noConsole?: true;\n  readonly immutable?: true;\n  readonly static?: true;\n  readonly noSideEffects?: true;\n  readonly noMutation?: true;\n  readonly noIO?: true;\n  readonly pure?: true;\n}\n\nexport type Kind<R extends PropertySet> = { readonly __kind?: R };\n\nexport type Immutable = Kind<{ immutable: true }>;\n"
    },
  ]
};
