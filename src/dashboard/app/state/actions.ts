import type { DashboardExportData, Stage, CheckView, FileViewerTab, ASTNode } from '../types';

export type Action =
  | { type: 'LOAD_DATA'; data: DashboardExportData }
  | { type: 'SWITCH_STAGE'; stage: Stage }
  | { type: 'SWITCH_CHECK_VIEW'; view: CheckView }
  | { type: 'SELECT_NODE'; id: string | null }
  | { type: 'OPEN_DETAIL'; detailType: string; payload: unknown }
  | { type: 'CLOSE_DETAIL' }
  | { type: 'SET_FILE_VIEWER_TAB'; tab: FileViewerTab }
  | { type: 'OPEN_ELK_GRAPH'; astNode: ASTNode; fileName: string }
  | { type: 'CLOSE_ELK_GRAPH' }
  | { type: 'ELK_TOGGLE_COLLAPSE'; nodeId: string }
  | { type: 'ELK_SET_COLLAPSED'; collapsed: Set<string> }
  | { type: 'ELK_SET_DIRECTION'; direction: 'RIGHT' | 'DOWN' }
  | { type: 'ELK_SELECT_NODE'; nodeId: string | null }
  | { type: 'SET_UPLOAD_OVERLAY'; open: boolean }
  | { type: 'SET_SEARCH_QUERY'; query: string };
