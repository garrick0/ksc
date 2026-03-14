/** AUTO-GENERATED — do not edit. */
import type { KindDefinition, Diagnostic } from '../types.js';
import type { ProtobufBinding } from '../equations/protobuf.js';

export interface KSCAttrMap {
  definitions: KindDefinition[];
  diagnostics: Diagnostic[];
  kindDefs: KindDefinition[];
  defEnv: Map<string, KindDefinition>;
  defLookup: ((name: string) => KindDefinition | undefined);
  kindAnnotations: KindDefinition[];
  allViolations: Diagnostic[];
  nodeCount: number;
  protobufTypes: Map<string, ProtobufBinding>;
  protobufTypeEnv: Set<string>;
  protobufViolation: Diagnostic | null;
  allProtobufViolations: Diagnostic[];
}