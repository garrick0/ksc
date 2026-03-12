// Auto-generated from 2-5-refactor-to-pure/
// DO NOT EDIT — regenerate with: npm run generate:lessons

import { Lesson } from './types';

export const lesson: Lesson = {
  "slug": "2-5-refactor-to-pure",
  "title": "Refactor to Pure",
  "partTitle": "Detecting Code Issues",
  "partNumber": 2,
  "lessonNumber": 5,
  "focus": "src/analytics.ts",
  "files": [
    {
      "path": "src/analytics.ts",
      "contents": "import type { Pure } from './kinds';\nimport { formatEvent } from './format';\n\n// Analytics computations should be pure — no imports, no console, no mutation.\n// Run `npm run check` to find the violations.\n\nexport const computeAverage: Pure & ((values: number[]) => number) = (values) => {\n  let sum = 0;\n  for (const v of values) {\n    sum += v;\n  }\n  return values.length > 0 ? sum / values.length : 0;\n};\n\nexport const computeTotal: Pure & ((items: { price: number; qty: number }[]) => number) = (items) => {\n  let total = 0;\n  for (const item of items) {\n    total += item.price * item.qty;\n  }\n  console.log(`Total: ${total}`);\n  return total;\n};\n\nexport const formatSummary: Pure & ((name: string, value: number) => string) = (name, value) => {\n  return formatEvent(name, value);\n};\n"
    },
    {
      "path": "src/format.ts",
      "contents": "// Shared formatting utilities (not kind-annotated).\n\nexport function formatEvent(name: string, value: number): string {\n  return `${name}: ${value.toFixed(2)}`;\n}\n"
    },
    {
      "path": "src/kinds.ts",
      "contents": "export interface PropertySet {\n  readonly noImports?: true;\n  readonly noConsole?: true;\n  readonly immutable?: true;\n  readonly static?: true;\n  readonly noSideEffects?: true;\n  readonly noMutation?: true;\n  readonly noIO?: true;\n  readonly pure?: true;\n}\n\nexport type Kind<R extends PropertySet> = { readonly __kind?: R };\n\nexport type NoConsole = Kind<{ noConsole: true }>;\nexport type NoMutation = Kind<{ noMutation: true }>;\nexport type Immutable = Kind<{ immutable: true }>;\nexport type Pure = Kind<{ noImports: true; noConsole: true; noMutation: true; immutable: true }>;\n"
    },
  ],
  "solution": [
    {
      "path": "src/analytics.ts",
      "contents": "import type { Pure } from './kinds';\n\n// Analytics computations — pure functions with no imports, no console, no mutation.\n\nexport const computeAverage: Pure & ((values: number[]) => number) = (values) => {\n  return values.length > 0\n    ? values.reduce((acc, v) => acc + v, 0) / values.length\n    : 0;\n};\n\nexport const computeTotal: Pure & ((items: { price: number; qty: number }[]) => number) = (items) => {\n  return items.reduce((acc, item) => acc + item.price * item.qty, 0);\n};\n\nexport const formatSummary: Pure & ((name: string, value: number) => string) = (name, value) => {\n  return `${name}: ${value.toFixed(2)}`;\n};\n"
    },
    {
      "path": "src/format.ts",
      "contents": "// Shared formatting utilities (not kind-annotated).\n\nexport function formatEvent(name: string, value: number): string {\n  return `${name}: ${value.toFixed(2)}`;\n}\n"
    },
    {
      "path": "src/kinds.ts",
      "contents": "export interface PropertySet {\n  readonly noImports?: true;\n  readonly noConsole?: true;\n  readonly immutable?: true;\n  readonly static?: true;\n  readonly noSideEffects?: true;\n  readonly noMutation?: true;\n  readonly noIO?: true;\n  readonly pure?: true;\n}\n\nexport type Kind<R extends PropertySet> = { readonly __kind?: R };\n\nexport type NoConsole = Kind<{ noConsole: true }>;\nexport type NoMutation = Kind<{ noMutation: true }>;\nexport type Immutable = Kind<{ immutable: true }>;\nexport type Pure = Kind<{ noImports: true; noConsole: true; noMutation: true; immutable: true }>;\n"
    },
  ]
};
