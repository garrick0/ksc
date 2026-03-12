// Auto-generated from 2-3-no-mutation/
// DO NOT EDIT — regenerate with: npm run generate:lessons

import { Lesson } from './types';

export const lesson: Lesson = {
  "slug": "2-3-no-mutation",
  "title": "No Mutation",
  "partTitle": "Detecting Code Issues",
  "partNumber": 2,
  "lessonNumber": 3,
  "focus": "src/transform.ts",
  "files": [
    {
      "path": "src/kinds.ts",
      "contents": "export interface PropertySet {\n  readonly noImports?: true;\n  readonly noConsole?: true;\n  readonly immutable?: true;\n  readonly static?: true;\n  readonly noSideEffects?: true;\n  readonly noMutation?: true;\n  readonly noIO?: true;\n  readonly pure?: true;\n}\n\nexport type Kind<R extends PropertySet> = { readonly __kind?: R };\n\nexport type NoMutation = Kind<{ noMutation: true }>;\n"
    },
    {
      "path": "src/transform.ts",
      "contents": "import type { NoMutation } from './kinds';\n\n// These functions should use functional patterns — no mutation allowed.\n// Run `npm run check` to find the violations.\n\nexport const sum: NoMutation & ((nums: number[]) => number) = (nums) => {\n  let total = 0;\n  for (const n of nums) {\n    total += n;\n  }\n  return total;\n};\n\nexport const incrementAll: NoMutation & ((nums: number[]) => number[]) = (nums) => {\n  for (let i = 0; i < nums.length; i++) {\n    nums[i] = nums[i] + 1;\n  }\n  return nums;\n};\n\nexport const countdown: NoMutation & ((start: number) => number[]) = (start) => {\n  const result: number[] = [];\n  let current = start;\n  while (current > 0) {\n    result.push(current);\n    current--;\n  }\n  return result;\n};\n"
    },
  ],
  "solution": [
    {
      "path": "src/kinds.ts",
      "contents": "export interface PropertySet {\n  readonly noImports?: true;\n  readonly noConsole?: true;\n  readonly immutable?: true;\n  readonly static?: true;\n  readonly noSideEffects?: true;\n  readonly noMutation?: true;\n  readonly noIO?: true;\n  readonly pure?: true;\n}\n\nexport type Kind<R extends PropertySet> = { readonly __kind?: R };\n\nexport type NoMutation = Kind<{ noMutation: true }>;\n"
    },
    {
      "path": "src/transform.ts",
      "contents": "import type { NoMutation } from './kinds';\n\n// These functions use functional patterns — no mutation.\n\nexport const sum: NoMutation & ((nums: number[]) => number) = (nums) => {\n  return nums.reduce((acc, n) => acc + n, 0);\n};\n\nexport const incrementAll: NoMutation & ((nums: number[]) => number[]) = (nums) => {\n  return nums.map((n) => n + 1);\n};\n\nexport const countdown: NoMutation & ((start: number) => number[]) = (start) => {\n  return Array.from({ length: start }, (_, i) => start - i);\n};\n"
    },
  ]
};
