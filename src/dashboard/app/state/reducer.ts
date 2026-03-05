import type { DashboardExportData, Stage, CheckView, FileViewerTab, ASTNode } from '../types';
import type { Action } from './actions';

export interface DashboardState {
  data: DashboardExportData | null;
  activeStage: Stage;
  checkView: CheckView;
  selectedNodeId: string | null;
  detailPanel: { open: boolean; type: string | null; payload: unknown };
  fileViewerTab: FileViewerTab;
  elkGraph: {
    open: boolean;
    astNode: ASTNode | null;
    fileName: string;
    collapsedNodes: Set<string>;
    direction: 'RIGHT' | 'DOWN';
    selectedNodeId: string | null;
  };
  uploadOverlayOpen: boolean;
  searchQuery: string;
}

export const initialState: DashboardState = {
  data: null,
  activeStage: 'parse',
  checkView: 'byFile',
  selectedNodeId: null,
  detailPanel: { open: false, type: null, payload: null },
  fileViewerTab: 'source',
  elkGraph: {
    open: false,
    astNode: null,
    fileName: '',
    collapsedNodes: new Set(),
    direction: 'RIGHT',
    selectedNodeId: null,
  },
  uploadOverlayOpen: false,
  searchQuery: '',
};

export function dashboardReducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case 'LOAD_DATA': {
      const data = action.data;
      // Normalize backward-compat
      if (!data.check) {
        (data as any).check = {
          diagnostics: [],
          summary: {
            totalFiles: data.parse?.sourceFiles.length ?? 0,
            totalDefinitions: 0,
            totalAnnotations: 0,
            totalDiagnostics: 0,
            cleanFiles: data.parse?.sourceFiles.length ?? 0,
            violatingFiles: 0,
            byProperty: {},
          },
        };
      }
      if (!data.kinds.annotations) {
        (data.kinds as any).annotations = [];
      }
      return { ...state, data, uploadOverlayOpen: false };
    }
    case 'SWITCH_STAGE':
      return {
        ...state,
        activeStage: action.stage,
        detailPanel: { open: false, type: null, payload: null },
        selectedNodeId: null,
      };
    case 'SWITCH_CHECK_VIEW':
      return { ...state, checkView: action.view };
    case 'SELECT_NODE':
      return { ...state, selectedNodeId: action.id };
    case 'OPEN_DETAIL':
      return {
        ...state,
        detailPanel: { open: true, type: action.detailType, payload: action.payload },
      };
    case 'CLOSE_DETAIL':
      return { ...state, detailPanel: { open: false, type: null, payload: null } };
    case 'SET_FILE_VIEWER_TAB':
      return { ...state, fileViewerTab: action.tab };
    case 'OPEN_ELK_GRAPH':
      return {
        ...state,
        elkGraph: {
          ...state.elkGraph,
          open: true,
          astNode: action.astNode,
          fileName: action.fileName,
          collapsedNodes: new Set(),
          selectedNodeId: null,
        },
      };
    case 'CLOSE_ELK_GRAPH':
      return {
        ...state,
        elkGraph: { ...initialState.elkGraph },
      };
    case 'ELK_TOGGLE_COLLAPSE': {
      const next = new Set(state.elkGraph.collapsedNodes);
      if (next.has(action.nodeId)) next.delete(action.nodeId);
      else next.add(action.nodeId);
      return { ...state, elkGraph: { ...state.elkGraph, collapsedNodes: next } };
    }
    case 'ELK_SET_COLLAPSED':
      return { ...state, elkGraph: { ...state.elkGraph, collapsedNodes: action.collapsed } };
    case 'ELK_SET_DIRECTION':
      return { ...state, elkGraph: { ...state.elkGraph, direction: action.direction } };
    case 'ELK_SELECT_NODE':
      return { ...state, elkGraph: { ...state.elkGraph, selectedNodeId: action.nodeId } };
    case 'SET_UPLOAD_OVERLAY':
      return { ...state, uploadOverlayOpen: action.open };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.query };
    default:
      return state;
  }
}
