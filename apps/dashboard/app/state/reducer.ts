import type { ASTDashboardData, ASTNode } from '../types';
import type { Action } from './actions';

export interface DashboardState {
  data: ASTDashboardData | null;
  selectedFileName: string | null;
  detailPanel: { open: boolean; type: string | null; payload: unknown };
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
  selectedFileName: null,
  detailPanel: { open: false, type: null, payload: null },
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
    case 'LOAD_DATA':
      return { ...state, data: action.data, uploadOverlayOpen: false };
    case 'SELECT_FILE':
      return {
        ...state,
        selectedFileName: action.fileName,
        detailPanel: {
          open: true,
          type: 'fileViewer',
          payload: { fileName: action.fileName },
        },
      };
    case 'OPEN_DETAIL':
      return {
        ...state,
        detailPanel: { open: true, type: action.detailType, payload: action.payload },
      };
    case 'CLOSE_DETAIL':
      return { ...state, detailPanel: { open: false, type: null, payload: null } };
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
      return { ...state, elkGraph: { ...initialState.elkGraph } };
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
