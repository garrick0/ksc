import type { AnalysisRuntime } from '@ksc/ag-ports';
import type { KindScriptConfig } from '@ksc/user-config';
import { dispatchConfig } from './generated/dispatch.js';
import { depGraph } from './generated/dep-graph.js';
import type { DispatchConfig } from '@ksc/ag-ports';

const protobufDisabledDispatch: DispatchConfig = {
  ...dispatchConfig,
  protobufTypes: { direction: 'syn', compute: () => new Map() },
  protobufTypeEnv: { direction: 'inh', computeRoot: () => new Set() },
  protobufViolation: { direction: 'syn', compute: () => null },
  allProtobufViolations: { direction: 'syn', compute: () => [] },
};

const runtimeWithProtobuf: AnalysisRuntime = {
  dispatch: dispatchConfig,
  depGraph,
};

const runtimeWithoutProtobuf: AnalysisRuntime = {
  dispatch: protobufDisabledDispatch,
  depGraph,
};

export function createRuntime(config?: KindScriptConfig): AnalysisRuntime {
  return config?.protobuf?.enabled ? runtimeWithProtobuf : runtimeWithoutProtobuf;
}

export const runtime = runtimeWithoutProtobuf;
