import type { DashboardExportData } from './types';

export const SAMPLE_DATA: DashboardExportData = {
  version: 2,
  project: {
    root: '/kindscript-project',
    generatedAt: new Date().toISOString(),
    rootFiles: ['src/kinds.ts', 'src/funcs/no-console.ts', 'src/funcs/no-mutation.ts', 'src/domain/handler.ts', 'src/infra/db.ts', 'src/pure/math.ts'],
  },
  parse: {
    sourceFiles: [
      {
        fileName: 'src/kinds.ts', lineCount: 10,
        declarations: [
          { id: 'p-0a', name: 'PropertySet', kind: 'Interface', pos: 0, end: 60, text: "export interface PropertySet { readonly noConsole?: true; ... }" },
          { id: 'p-0b', name: 'Kind', kind: 'TypeAlias', pos: 61, end: 120, text: "export type Kind<R extends PropertySet> = { readonly __kind?: R }" },
          { id: 'p-0c', name: 'NoConsole', kind: 'TypeAlias', pos: 121, end: 170, text: "type NoConsole = Kind<{ noConsole: true }>" },
          { id: 'p-0d', name: 'NoMutation', kind: 'TypeAlias', pos: 171, end: 220, text: "type NoMutation = Kind<{ noMutation: true }>" },
          { id: 'p-0e', name: 'NoImports', kind: 'TypeAlias', pos: 221, end: 270, text: "type NoImports = Kind<{ noImports: true }>" },
        ],
        source: "import type { Kind, PropertySet } from 'kindscript';\n\ntype NoConsole = Kind<{ noConsole: true }>;\ntype NoMutation = Kind<{ noMutation: true }>;\ntype NoImports = Kind<{ noImports: true }>;\n",
      },
      {
        fileName: 'src/funcs/no-console.ts', lineCount: 8,
        declarations: [
          { id: 'p-1', name: 'greet', kind: 'Const', pos: 0, end: 80, text: "const greet: NoConsole & ((name: string) => void) = (name) => { console.log('Hello, ' + name); }" },
        ],
        source: "import type { NoConsole } from '../kinds';\n\nconst greet: NoConsole & ((name: string) => void) = (name) => {\n  console.log('Hello, ' + name);\n};\n",
        ast: {
          kind: 'SourceFile', pos: 0, end: 80, text: '// File with console usage...', children: [
            { kind: 'ImportDeclaration', pos: 0, end: 42, text: "import type { NoConsole } from '../kinds'", children: [
              { kind: 'ImportClause', pos: 7, end: 27, text: 'type { NoConsole }', children: [
                { kind: 'NamedImports', pos: 14, end: 27, text: '{ NoConsole }', children: [
                  { kind: 'ImportSpecifier', name: 'NoConsole', pos: 16, end: 25, text: 'NoConsole', children: [] },
                ] },
              ] },
              { kind: 'StringLiteral', pos: 33, end: 42, text: "'../kinds'", children: [] },
            ] },
            { kind: 'VariableStatement', pos: 44, end: 80, text: 'const greet: NoConsole & ((name: string) => void) = ...', children: [
              { kind: 'VariableDeclarationList', pos: 44, end: 79, text: 'const greet: NoConsole & ...', children: [
                { kind: 'VariableDeclaration', name: 'greet', pos: 50, end: 79, text: 'greet: NoConsole & ...', children: [
                  { kind: 'Identifier', name: 'greet', pos: 50, end: 55, text: 'greet', children: [] },
                  { kind: 'IntersectionType', pos: 57, end: 74, text: 'NoConsole & ((name: string) => void)', children: [
                    { kind: 'TypeReference', name: 'NoConsole', pos: 57, end: 66, text: 'NoConsole', children: [] },
                    { kind: 'FunctionType', pos: 69, end: 74, text: '(name: string) => void', children: [] },
                  ] },
                  { kind: 'ArrowFunction', pos: 77, end: 79, text: '(name) => { ... }', children: [
                    { kind: 'Parameter', name: 'name', pos: 78, end: 82, text: 'name', children: [] },
                    { kind: 'Block', pos: 87, end: 79, text: '{ console.log(...) }', children: [
                      { kind: 'ExpressionStatement', pos: 89, end: 76, text: "console.log('Hello, ' + name);", children: [
                        { kind: 'CallExpression', pos: 89, end: 75, text: "console.log('Hello, ' + name)", children: [
                          { kind: 'PropertyAccessExpression', pos: 89, end: 100, text: 'console.log', children: [
                            { kind: 'Identifier', name: 'console', pos: 89, end: 96, text: 'console', children: [] },
                            { kind: 'Identifier', name: 'log', pos: 97, end: 100, text: 'log', children: [] },
                          ] },
                          { kind: 'BinaryExpression', pos: 101, end: 74, text: "'Hello, ' + name", children: [
                            { kind: 'StringLiteral', pos: 101, end: 110, text: "'Hello, '", children: [] },
                            { kind: 'PlusToken', pos: 111, end: 112, text: '+', children: [] },
                            { kind: 'Identifier', name: 'name', pos: 113, end: 117, text: 'name', children: [] },
                          ] },
                        ] },
                      ] },
                    ] },
                  ] },
                ] },
              ] },
            ] },
          ],
        },
      },
      {
        fileName: 'src/funcs/no-mutation.ts', lineCount: 10,
        declarations: [
          { id: 'p-2', name: 'mutate', kind: 'Const', pos: 0, end: 120, text: "const mutate: NoMutation & (() => number) = () => { let x = 0; x = 1; x++; return x; }" },
        ],
        source: "import type { NoMutation } from '../kinds';\n\nconst mutate: NoMutation & (() => number) = () => {\n  let x = 0;\n  x = 1;\n  x++;\n  return x;\n};\n",
      },
      {
        fileName: 'src/domain/handler.ts', lineCount: 9,
        declarations: [
          { id: 'p-20', name: 'something', kind: 'Import', pos: 0, end: 35, text: "import { something } from './other'" },
          { id: 'p-21', name: 'handle', kind: 'Const', pos: 36, end: 120, text: "const handle: NoImports & (() => number) = () => { return something(); }" },
        ],
        source: "import type { NoImports } from '../kinds';\nimport { something } from './other';\n\nconst handle: NoImports & (() => number) = () => {\n  return something();\n};\n",
      },
      {
        fileName: 'src/domain/other.ts', lineCount: 5,
        declarations: [
          { id: 'p-22', name: 'something', kind: 'Function', pos: 0, end: 80, text: "export function something() { return 42; }" },
        ],
        source: "// Helper module in domain directory.\n\nexport function something() {\n  return 42;\n}\n",
      },
      {
        fileName: 'src/infra/db.ts', lineCount: 9,
        declarations: [
          { id: 'p-30', name: 'fs', kind: 'Import', pos: 0, end: 34, text: "import { readFileSync } from 'fs'" },
          { id: 'p-31', name: 'loadConfig', kind: 'Const', pos: 35, end: 120, text: "const loadConfig: NoImports & ((path: string) => string) = (path) => readFileSync(path, 'utf-8')" },
        ],
        source: "import type { NoImports } from '../kinds';\nimport { readFileSync } from 'fs';\n\nconst loadConfig: NoImports & ((path: string) => string) = (path) =>\n  readFileSync(path, 'utf-8');\n",
      },
      {
        fileName: 'src/pure/math.ts', lineCount: 12,
        declarations: [
          { id: 'p-40', name: 'PI', kind: 'Const', pos: 0, end: 40, text: "export const PI = 3.14159" },
          { id: 'p-41', name: 'add', kind: 'Const', pos: 41, end: 100, text: "const add: NoConsole & ((a: number, b: number) => number) = (a, b) => a + b" },
          { id: 'p-42', name: 'multiply', kind: 'Const', pos: 101, end: 170, text: "const multiply: NoConsole & ((a: number, b: number) => number) = (a, b) => a * b" },
        ],
        source: "import type { NoConsole } from '../kinds';\n\nexport const PI = 3.14159;\n\nconst add: NoConsole & ((a: number, b: number) => number) = (a, b) => a + b;\n\nconst multiply: NoConsole & ((a: number, b: number) => number) = (a, b) => a * b;\n",
      },
    ],
  },
  kinds: {
    definitions: [
      { id: 'kdef-0', name: 'NoConsole', properties: { noConsole: true }, sourceFile: 'src/kinds.ts' },
      { id: 'kdef-1', name: 'NoMutation', properties: { noMutation: true }, sourceFile: 'src/kinds.ts' },
      { id: 'kdef-2', name: 'NoImports', properties: { noImports: true }, sourceFile: 'src/kinds.ts' },
    ],
    annotations: [
      { id: 'kann-0', kindName: 'NoConsole', name: 'greet', sourceFile: 'src/funcs/no-console.ts' },
      { id: 'kann-1', kindName: 'NoMutation', name: 'mutate', sourceFile: 'src/funcs/no-mutation.ts' },
      { id: 'kann-2', kindName: 'NoImports', name: 'handle', sourceFile: 'src/domain/handler.ts' },
      { id: 'kann-3', kindName: 'NoImports', name: 'loadConfig', sourceFile: 'src/infra/db.ts' },
      { id: 'kann-4', kindName: 'NoConsole', name: 'add', sourceFile: 'src/pure/math.ts' },
      { id: 'kann-5', kindName: 'NoConsole', name: 'multiply', sourceFile: 'src/pure/math.ts' },
    ],
  },
  check: {
    diagnostics: [
      { id: 'c-1', file: 'src/funcs/no-console.ts', code: 70200, property: 'noConsole', message: "Kind property 'noConsole' violated: console usage is not allowed.", start: 90, length: 30, line: 4, column: 3 },
      { id: 'c-2', file: 'src/funcs/no-mutation.ts', code: 70200, property: 'noMutation', message: "Kind property 'noMutation' violated: mutation is not allowed. Assignment to 'x'.", start: 80, length: 5, line: 5, column: 3 },
      { id: 'c-3', file: 'src/domain/handler.ts', code: 70200, property: 'noImports', message: "Kind property 'noImports' violated: file contains non-type-only import: import { something } from './other'", start: 0, length: 35, line: 2, column: 1 },
      { id: 'c-4', file: 'src/infra/db.ts', code: 70200, property: 'noImports', message: "Kind property 'noImports' violated: file contains non-type-only import: import { readFileSync } from 'fs'", start: 0, length: 34, line: 2, column: 1 },
    ],
    summary: {
      totalFiles: 7, totalDefinitions: 3, totalAnnotations: 6, totalDiagnostics: 4,
      cleanFiles: 5, violatingFiles: 2,
      byProperty: {
        noConsole: { checked: 3, violations: 1 },
        noMutation: { checked: 1, violations: 1 },
        noImports: { checked: 2, violations: 2 },
      },
    },
  },
};
