/**
 * User Configuration Schema — External settings for the KindScript platform.
 *
 * This package defines how humans parameterize the tool via a configuration file.
 */

import type { AnalysisDepth } from '@ksc/types';

/** Compiler settings for KindScript. */
export interface KindScriptConfig {
  /** How much TS analysis to perform during conversion: parse, bind, or check. Default: 'check'. */
  readonly analysisDepth?: AnalysisDepth;
  /** Glob patterns for files to include. */
  readonly include?: readonly string[];
  /** Glob patterns for files to exclude. */
  readonly exclude?: readonly string[];
  /** Protobuf getter enforcement. When enabled, flags direct field access on protobuf messages. */
  readonly protobuf?: {
    /** Enable protobuf getter checking. Default: false. */
    readonly enabled?: boolean;
    /** Glob patterns for protobuf module specifiers. Default: ['*_pb', '*_grpc_web_pb']. */
    readonly modules?: readonly string[];
  };
}

/**
 * Identity function that provides type-safe autocompletion for configs.
 *
 *   export default defineConfig({ analysisDepth: 'check' });
 */
export function defineConfig(config: KindScriptConfig): KindScriptConfig {
  return config;
}
