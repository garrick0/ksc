import type { ASTDashboardData } from './types';

export const SAMPLE_DATA: ASTDashboardData = {
  version: 2,
  schema: {
    fieldDefs: {
      'ImportDeclaration': [
        { name: 'importClause', tag: 'optChild', typeRef: 'ImportClause' },
        { name: 'moduleSpecifier', tag: 'child', typeRef: 'Expression' },
        { name: 'attributes', tag: 'optChild', typeRef: 'ImportAttributes' },
        { name: 'modifiers', tag: 'list', typeRef: 'Modifier' },
      ],
      'ImportClause': [
        { name: 'name', tag: 'optChild', typeRef: 'Identifier' },
        { name: 'namedBindings', tag: 'optChild', typeRef: 'NamedImportBindings' },
      ],
      'NamedImports': [
        { name: 'elements', tag: 'list', typeRef: 'ImportSpecifier' },
      ],
      'ImportSpecifier': [
        { name: 'name', tag: 'child', typeRef: 'Identifier' },
        { name: 'propertyName', tag: 'optChild', typeRef: 'Identifier' },
      ],
      'TypeAliasDeclaration': [
        { name: 'name', tag: 'child', typeRef: 'Identifier' },
        { name: 'typeParameters', tag: 'list', typeRef: 'TypeParameter' },
        { name: 'type', tag: 'child', typeRef: 'TypeNode' },
        { name: 'modifiers', tag: 'list', typeRef: 'Modifier' },
      ],
      'VariableStatement': [
        { name: 'declarationList', tag: 'child', typeRef: 'VariableDeclarationList' },
        { name: 'modifiers', tag: 'list', typeRef: 'Modifier' },
      ],
      'VariableDeclarationList': [
        { name: 'declarations', tag: 'list', typeRef: 'VariableDeclaration' },
      ],
      'VariableDeclaration': [
        { name: 'name', tag: 'child', typeRef: 'BindingName' },
        { name: 'exclamationToken', tag: 'optChild', typeRef: 'ExclamationToken' },
        { name: 'type', tag: 'optChild', typeRef: 'TypeNode' },
        { name: 'initializer', tag: 'optChild', typeRef: 'Expression' },
      ],
      'TypeReference': [
        { name: 'typeName', tag: 'child', typeRef: 'EntityName' },
        { name: 'typeArguments', tag: 'list', typeRef: 'TypeNode' },
      ],
      'IntersectionType': [
        { name: 'types', tag: 'list', typeRef: 'TypeNode' },
      ],
      'ArrowFunction': [
        { name: 'typeParameters', tag: 'list', typeRef: 'TypeParameter' },
        { name: 'parameters', tag: 'list', typeRef: 'Parameter' },
        { name: 'type', tag: 'optChild', typeRef: 'TypeNode' },
        { name: 'equalsGreaterThanToken', tag: 'child', typeRef: 'EqualsGreaterThanToken' },
        { name: 'body', tag: 'child', typeRef: 'ConciseBody' },
        { name: 'modifiers', tag: 'list', typeRef: 'Modifier' },
      ],
      'Block': [
        { name: 'statements', tag: 'list', typeRef: 'Statement' },
      ],
      'ExpressionStatement': [
        { name: 'expression', tag: 'child', typeRef: 'Expression' },
      ],
      'CallExpression': [
        { name: 'expression', tag: 'child', typeRef: 'LeftHandSideExpression' },
        { name: 'typeArguments', tag: 'list', typeRef: 'TypeNode' },
        { name: 'arguments', tag: 'list', typeRef: 'Expression' },
        { name: 'questionDotToken', tag: 'optChild', typeRef: 'QuestionDotToken' },
      ],
      'PropertyAccessExpression': [
        { name: 'expression', tag: 'child', typeRef: 'LeftHandSideExpression' },
        { name: 'name', tag: 'child', typeRef: 'MemberName' },
        { name: 'questionDotToken', tag: 'optChild', typeRef: 'QuestionDotToken' },
      ],
      'BinaryExpression': [
        { name: 'left', tag: 'child', typeRef: 'Expression' },
        { name: 'operatorToken', tag: 'child', typeRef: 'Token' },
        { name: 'right', tag: 'child', typeRef: 'Expression' },
      ],
      'Parameter': [
        { name: 'name', tag: 'child', typeRef: 'BindingName' },
        { name: 'type', tag: 'optChild', typeRef: 'TypeNode' },
        { name: 'initializer', tag: 'optChild', typeRef: 'Expression' },
        { name: 'dotDotDotToken', tag: 'optChild', typeRef: 'DotDotDotToken' },
        { name: 'questionToken', tag: 'optChild', typeRef: 'QuestionToken' },
        { name: 'modifiers', tag: 'list', typeRef: 'Modifier' },
      ],
      'Identifier': [
        { name: 'escapedText', tag: 'prop', typeRef: 'string' },
      ],
    },
    sumTypes: {
      'ImportDeclaration': ['Statement', 'Declaration'],
      'TypeAliasDeclaration': ['Statement', 'Declaration', 'DeclarationStatement'],
      'VariableStatement': ['Statement'],
      'VariableDeclaration': ['Declaration'],
      'VariableDeclarationList': [],
      'ArrowFunction': ['Expression', 'Declaration', 'FunctionLikeDeclaration', 'SignatureDeclaration'],
      'BinaryExpression': ['Expression'],
      'CallExpression': ['Expression', 'LeftHandSideExpression'],
      'PropertyAccessExpression': ['Expression', 'MemberExpression', 'LeftHandSideExpression'],
      'ExpressionStatement': ['Statement'],
      'Block': ['Statement'],
      'Parameter': ['Declaration', 'SignatureDeclaration'],
      'Identifier': ['Expression', 'PrimaryExpression', 'Declaration', 'PropertyName', 'EntityName', 'BindingName', 'MemberName'],
      'StringLiteral': ['Expression', 'Literal'],
      'NumericLiteral': ['Expression', 'Literal'],
      'TypeReference': ['TypeNode'],
      'IntersectionType': ['TypeNode'],
      'FunctionType': ['TypeNode', 'SignatureDeclaration'],
      'PlusToken': ['Token'],
    },
  },
  files: [
    {
      fileName: 'src/kinds.ts',
      lineCount: 6,
      source: "import type { Kind, PropertySet } from 'kindscript';\n\ntype NoConsole = Kind<{ noConsole: true }>;\ntype NoMutation = Kind<{ noMutation: true }>;\ntype NoImports = Kind<{ noImports: true }>;\n",
      ast: {
        kind: 'CompilationUnit', pos: 0, end: 200, text: 'src/kinds.ts', children: [
          { kind: 'ImportDeclaration', pos: 0, end: 52, text: "import type { Kind, PropertySet } from 'kindscript'",
            fields: [{ name: 'importClause', indices: [0] }, { name: 'moduleSpecifier', indices: [1] }],
            children: [
              { kind: 'ImportClause', pos: 7, end: 36, text: 'type { Kind, PropertySet }',
                fields: [{ name: 'namedBindings', indices: [0] }],
                children: [
                  { kind: 'NamedImports', pos: 12, end: 36, text: '{ Kind, PropertySet }',
                    fields: [{ name: 'elements', indices: [0, 1] }],
                    children: [
                      { kind: 'ImportSpecifier', name: 'Kind', pos: 14, end: 18, text: 'Kind', children: [], props: { escapedText: 'Kind' } },
                      { kind: 'ImportSpecifier', name: 'PropertySet', pos: 20, end: 31, text: 'PropertySet', children: [], props: { escapedText: 'PropertySet' } },
                    ] },
                ] },
              { kind: 'StringLiteral', pos: 42, end: 52, text: "'kindscript'", children: [], props: { value: 'kindscript' } },
            ] },
          { kind: 'TypeAliasDeclaration', name: 'NoConsole', pos: 54, end: 95, text: "type NoConsole = Kind<{ noConsole: true }>",
            fields: [{ name: 'name', indices: [0] }, { name: 'type', indices: [1] }],
            children: [
              { kind: 'Identifier', name: 'NoConsole', pos: 59, end: 68, text: 'NoConsole', children: [], props: { escapedText: 'NoConsole' } },
              { kind: 'TypeReference', name: 'Kind', pos: 71, end: 95, text: 'Kind<{ noConsole: true }>', children: [] },
            ] },
          { kind: 'TypeAliasDeclaration', name: 'NoMutation', pos: 97, end: 141, text: "type NoMutation = Kind<{ noMutation: true }>",
            fields: [{ name: 'name', indices: [0] }, { name: 'type', indices: [1] }],
            children: [
              { kind: 'Identifier', name: 'NoMutation', pos: 102, end: 112, text: 'NoMutation', children: [], props: { escapedText: 'NoMutation' } },
              { kind: 'TypeReference', name: 'Kind', pos: 115, end: 141, text: 'Kind<{ noMutation: true }>', children: [] },
            ] },
          { kind: 'TypeAliasDeclaration', name: 'NoImports', pos: 143, end: 185, text: "type NoImports = Kind<{ noImports: true }>",
            fields: [{ name: 'name', indices: [0] }, { name: 'type', indices: [1] }],
            children: [
              { kind: 'Identifier', name: 'NoImports', pos: 148, end: 157, text: 'NoImports', children: [], props: { escapedText: 'NoImports' } },
              { kind: 'TypeReference', name: 'Kind', pos: 160, end: 185, text: 'Kind<{ noImports: true }>', children: [] },
            ] },
        ],
      },
    },
    {
      fileName: 'src/funcs/no-console.ts',
      lineCount: 5,
      source: "import type { NoConsole } from '../kinds';\n\nconst greet: NoConsole & ((name: string) => void) = (name) => {\n  console.log('Hello, ' + name);\n};\n",
      ast: {
        kind: 'CompilationUnit', pos: 0, end: 150, text: 'src/funcs/no-console.ts', children: [
          { kind: 'ImportDeclaration', pos: 0, end: 42, text: "import type { NoConsole } from '../kinds'",
            fields: [{ name: 'importClause', indices: [0] }, { name: 'moduleSpecifier', indices: [1] }],
            children: [
              { kind: 'ImportClause', pos: 7, end: 27, text: 'type { NoConsole }',
                fields: [{ name: 'namedBindings', indices: [0] }],
                children: [
                  { kind: 'NamedImports', pos: 14, end: 27, text: '{ NoConsole }',
                    fields: [{ name: 'elements', indices: [0] }],
                    children: [
                      { kind: 'ImportSpecifier', name: 'NoConsole', pos: 16, end: 25, text: 'NoConsole', children: [] },
                    ] },
                ] },
              { kind: 'StringLiteral', pos: 33, end: 42, text: "'../kinds'", children: [] },
            ] },
          { kind: 'VariableStatement', pos: 44, end: 150, text: 'const greet: NoConsole & ...',
            fields: [{ name: 'declarationList', indices: [0] }],
            children: [
              { kind: 'VariableDeclarationList', pos: 44, end: 149, text: 'const greet: NoConsole & ...',
                fields: [{ name: 'declarations', indices: [0] }],
                children: [
                  { kind: 'VariableDeclaration', name: 'greet', pos: 50, end: 149, text: 'greet: NoConsole & ...',
                    fields: [{ name: 'name', indices: [0] }, { name: 'type', indices: [1] }, { name: 'initializer', indices: [2] }],
                    children: [
                      { kind: 'Identifier', name: 'greet', pos: 50, end: 55, text: 'greet', children: [], props: { escapedText: 'greet' } },
                      { kind: 'IntersectionType', pos: 57, end: 93, text: 'NoConsole & ((name: string) => void)',
                        fields: [{ name: 'types', indices: [0, 1] }],
                        children: [
                          { kind: 'TypeReference', name: 'NoConsole', pos: 57, end: 66, text: 'NoConsole', children: [] },
                          { kind: 'FunctionType', pos: 69, end: 93, text: '(name: string) => void', children: [] },
                        ] },
                      { kind: 'ArrowFunction', pos: 96, end: 149, text: '(name) => { ... }',
                        fields: [{ name: 'parameters', indices: [0] }, { name: 'body', indices: [1] }],
                        children: [
                          { kind: 'Parameter', name: 'name', pos: 97, end: 101, text: 'name', children: [] },
                          { kind: 'Block', pos: 106, end: 149, text: '{ console.log(...) }',
                            fields: [{ name: 'statements', indices: [0] }],
                            children: [
                              { kind: 'ExpressionStatement', pos: 110, end: 141, text: "console.log('Hello, ' + name);",
                                fields: [{ name: 'expression', indices: [0] }],
                                children: [
                                  { kind: 'CallExpression', pos: 110, end: 140, text: "console.log('Hello, ' + name)",
                                    fields: [{ name: 'expression', indices: [0] }, { name: 'arguments', indices: [1] }],
                                    children: [
                                      { kind: 'PropertyAccessExpression', pos: 110, end: 121, text: 'console.log',
                                        fields: [{ name: 'expression', indices: [0] }, { name: 'name', indices: [1] }],
                                        children: [
                                          { kind: 'Identifier', name: 'console', pos: 110, end: 117, text: 'console', children: [], props: { escapedText: 'console' } },
                                          { kind: 'Identifier', name: 'log', pos: 118, end: 121, text: 'log', children: [], props: { escapedText: 'log' } },
                                        ] },
                                      { kind: 'BinaryExpression', pos: 122, end: 139, text: "'Hello, ' + name",
                                        fields: [{ name: 'left', indices: [0] }, { name: 'operatorToken', indices: [1] }, { name: 'right', indices: [2] }],
                                        children: [
                                          { kind: 'StringLiteral', pos: 122, end: 131, text: "'Hello, '", children: [] },
                                          { kind: 'PlusToken', pos: 132, end: 133, text: '+', children: [] },
                                          { kind: 'Identifier', name: 'name', pos: 134, end: 138, text: 'name', children: [], props: { escapedText: 'name' } },
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
      fileName: 'src/pure/math.ts',
      lineCount: 7,
      source: "import type { NoConsole } from '../kinds';\n\nexport const PI = 3.14159;\n\nconst add: NoConsole & ((a: number, b: number) => number) = (a, b) => a + b;\n\nconst multiply: NoConsole & ((a: number, b: number) => number) = (a, b) => a * b;\n",
      ast: {
        kind: 'CompilationUnit', pos: 0, end: 200, text: 'src/pure/math.ts', children: [
          { kind: 'ImportDeclaration', pos: 0, end: 42, text: "import type { NoConsole } from '../kinds'", children: [] },
          { kind: 'VariableStatement', pos: 44, end: 69, text: 'export const PI = 3.14159',
            fields: [{ name: 'declarationList', indices: [0] }],
            children: [
              { kind: 'VariableDeclarationList', pos: 44, end: 69, text: 'const PI = 3.14159',
                fields: [{ name: 'declarations', indices: [0] }],
                children: [
                  { kind: 'VariableDeclaration', name: 'PI', pos: 58, end: 69, text: 'PI = 3.14159',
                    fields: [{ name: 'name', indices: [0] }, { name: 'initializer', indices: [1] }],
                    children: [
                      { kind: 'Identifier', name: 'PI', pos: 58, end: 60, text: 'PI', children: [], props: { escapedText: 'PI' } },
                      { kind: 'NumericLiteral', pos: 63, end: 69, text: '3.14159', children: [] },
                    ] },
                ] },
            ] },
          { kind: 'VariableStatement', pos: 71, end: 147, text: 'const add: NoConsole & ...', children: [] },
          { kind: 'VariableStatement', pos: 149, end: 200, text: 'const multiply: NoConsole & ...', children: [] },
        ],
      },
    },
  ],
};
