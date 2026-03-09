/**
 * Integration tests for codegen scripts.
 *
 * Verifies that the codegen pipeline executes successfully and produces
 * the expected output files. Uses the actual grammar/analysis specs.
 */
import { describe, it, expect } from 'vitest';

// Grammar spec factory + builder
import { createGrammarBuilder } from '../grammar/builder.js';
import { buildGrammarSpec } from '../specs/ts-ast/grammar/spec.js';
import { SKIP_CONVERT, SYNTAX_KIND_OVERRIDES } from '../specs/ts-ast/grammar/extractors.js';

// Import functors
import { compileGrammar } from '../grammar/compile.js';
import { compileAnalysis } from '../analysis/compile.js';
import { validateSpec } from '../analysis/validate.js';
import { analysisSpec } from '../specs/ts-ast/kind-checking/spec.js';

describe('buildGrammarSpec', () => {
  it('produces a valid spec with convertGenerator', () => {
    const spec = buildGrammarSpec(createGrammarBuilder());
    expect(spec.nodes.size).toBeGreaterThan(300);
    expect(spec.sumTypes.size).toBeGreaterThan(40);
    expect(spec.convertGenerator).toBeTypeOf('function');
  });

  it('extractors data includes skipConvert and syntaxKindOverrides', () => {
    expect(SKIP_CONVERT).toContain('Program');
    expect(SKIP_CONVERT).toContain('CompilationUnit');
    expect(SYNTAX_KIND_OVERRIDES.JSDocCommentTextToken).toBe(82);
  });
});

describe('codegen pipeline', () => {
  it('compileGrammar produces expected files', () => {
    const spec = buildGrammarSpec(createGrammarBuilder());
    const result = compileGrammar(spec);

    const filePaths = result.files.map(f => f.path);
    expect(filePaths).toContain('node-types.ts');
    expect(filePaths).toContain('schema.ts');
    expect(filePaths).toContain('convert.ts');
    expect(filePaths).toContain('builders.ts');
    expect(filePaths).toContain('serialize.ts');
    expect(filePaths).toContain('kind-map.ts');
    expect(filePaths).toContain('index.ts');

    // All files have non-empty content
    for (const file of result.files) {
      expect(file.content.length).toBeGreaterThan(0);
    }
  });

  it('spec validation passes with real specs', () => {
    const diags = validateSpec(analysisSpec);

    const errors = diags.filter(d => d.level === 'error');
    expect(errors).toEqual([]);
  });

  it('compileAnalysis produces evaluator and attr-types', () => {
    const result = compileAnalysis(analysisSpec);

    expect(result.evaluatorFile.path).toBe('evaluator.ts');
    expect(result.attrTypesFile.path).toBe('attr-types.ts');
    expect(result.evaluatorFile.content.length).toBeGreaterThan(0);
    expect(result.attrTypesFile.content.length).toBeGreaterThan(0);
    expect(result.attrs.length).toBe(8);
    expect(result.depGraph.order.length).toBe(8);
    expect(result.depGraph.edges.length).toBe(6);
  });

  it('compileAnalysis uses custom specImportPath', () => {
    const result = compileAnalysis(analysisSpec, {
      specImportPath: '../specs/ts-ast/kind-checking/spec.js',
    });
    expect(result.evaluatorFile.content).toContain(
      "from '../specs/ts-ast/kind-checking/spec.js'"
    );
  });
});
