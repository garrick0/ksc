import type { ASTNode, Grammar } from '@ksc/grammar/index.js';
export type {
  SynDispatchEntry,
  InhDispatchEntry,
  CollectionDispatchEntry,
  DispatchEntry,
  DispatchConfig,
} from '@ksc/ag-ports';
export type { AGNodeInterface, TypedAGNode } from '@ksc/ag-ports';
import type { DispatchConfig as DispatchConfigType } from '@ksc/ag-ports';

export interface BuildTreeArgs<K extends string = string> {
  grammar: Grammar<K>;
  dispatch: DispatchConfigType;
  root: ASTNode;
}

export interface EvaluateArgs<K extends string = string> extends BuildTreeArgs<K> {
  setup?: () => void;
}
