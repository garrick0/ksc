import ts from 'typescript';
import { evaluate } from '../../../../libs/evaluation/index.js';
import { grammar, translator, createRuntime } from './runtime.js';

export function createProgram(rootNames, config, options) {
  const tsProgram = ts.createProgram(rootNames, options ?? {});
  return createProgramFromTSProgram(tsProgram, config);
}

export function createProgramFromTSProgram(tsProgram, config) {
  const runtime = createRuntime(config);
  const depth = config?.analysisDepth ?? 'check';
  const ksTree = translator.convert(tsProgram, depth);
  const tree = evaluate({
    grammar,
    dispatch: runtime.dispatch,
    root: ksTree.root,
  });

  return {
    getRootFileNames: () => ksTree.root.compilationUnits.map(cu => cu.fileName),
    getCompilationUnits: () => ksTree.root.compilationUnits,
    getKindDefinitions: () => tree.attr('definitions'),
    getDiagnostics: () => tree.attr('diagnostics'),
    getKSTree: () => ksTree,
    getAttributeDepGraph: () => runtime.depGraph,
  };
}
