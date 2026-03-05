/** Re-export the data contract from the compiler pipeline. */
export type { DashboardExportData, ASTNode } from '../export.js';

export type Stage = 'parse' | 'bind' | 'check';
export type CheckView = 'byFile' | 'byProperty';
export type FileViewerTab = 'source' | 'ast' | 'graph';
