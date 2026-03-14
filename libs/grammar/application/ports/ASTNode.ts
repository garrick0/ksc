/** Base shape for all AST nodes. */
export interface ASTNode {
  kind: string;
  pos: number;
  end: number;
  text: string;
  children: ASTNode[];
}
