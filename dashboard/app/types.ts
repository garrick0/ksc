/** Dashboard data types — self-contained, no pipeline imports. */

export interface ASTFieldEntry {
  name: string;
  indices: number[];
}

export interface ASTNode {
  kind: string;
  name?: string;
  pos: number;
  end: number;
  text: string;
  children: ASTNode[];
  fields?: ASTFieldEntry[];
  props?: Record<string, string | number | boolean>;
}

export interface ASTSchemaInfo {
  fieldDefs: Record<string, readonly { name: string; tag: string; typeRef?: string }[]>;
  sumTypes: Record<string, readonly string[]>;
}

export interface ASTDashboardData {
  version: number;
  schema?: ASTSchemaInfo;
  files: Array<{
    fileName: string;
    lineCount: number;
    source: string;
    ast: ASTNode;
  }>;
}

export type FileViewerTab = 'source' | 'ast' | 'graph';
