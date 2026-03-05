import { useRef, useCallback, useState } from 'react';
import { useDashboardState, useDashboardDispatch } from '../../state/context';
import { useELKGraph } from './useELKGraph';
import { useTooltip } from '../../hooks/useTooltip';
import { useKeyboard } from '../../hooks/useKeyboard';
import { ELKGraphToolbar } from './ELKGraphToolbar';
import { ELKGraphDetail } from './ELKGraphDetail';
import { shortFileName, escHtml } from '../../utils/helpers';
import { assignASTIds, computeSmartCollapse, computeOutlineCollapse, computeDepthCollapse, type ELKNodeData } from './elkHelpers';
import type { ASTNode } from '../../types';

export function ELKGraphModal() {
  const { elkGraph } = useDashboardState();
  const dispatch = useDashboardDispatch();
  const { show, hide } = useTooltip();
  const containerRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const [detailNode, setDetailNode] = useState<{ node: ELKNodeData; label: string } | null>(null);

  // Assign IDs on mount
  if (elkGraph.astNode) {
    assignASTIds(elkGraph.astNode, 'n0');
    // Apply smart collapse if no collapsed nodes yet
    if (elkGraph.collapsedNodes.size === 0) {
      const smart = computeSmartCollapse(elkGraph.astNode);
      if (smart.size > 0) {
        // Dispatch after render via microtask
        Promise.resolve().then(() => dispatch({ type: 'ELK_SET_COLLAPSED', collapsed: smart }));
      }
    }
  }

  const handleSelectNode = useCallback((id: string | null) => {
    dispatch({ type: 'ELK_SELECT_NODE', nodeId: id });
  }, [dispatch]);

  const handleToggleCollapse = useCallback((id: string) => {
    dispatch({ type: 'ELK_TOGGLE_COLLAPSE', nodeId: id });
  }, [dispatch]);

  const handleShowDetail = useCallback((node: ELKNodeData, label: string) => {
    setDetailNode({ node, label });
  }, []);

  const handleHideDetail = useCallback(() => {
    setDetailNode(null);
  }, []);

  const { fitView } = useELKGraph(containerRef, {
    astNode: elkGraph.astNode!,
    collapsedNodes: elkGraph.collapsedNodes,
    direction: elkGraph.direction,
    selectedNodeId: elkGraph.selectedNodeId,
    onSelectNode: handleSelectNode,
    onToggleCollapse: handleToggleCollapse,
    showTooltip: show,
    hideTooltip: hide,
    onShowDetail: handleShowDetail,
    onHideDetail: handleHideDetail,
    infoRef,
  });

  useKeyboard('Escape', () => dispatch({ type: 'CLOSE_ELK_GRAPH' }));

  return (
    <div id="ast-graph-modal" className="open">
      <ELKGraphToolbar
        fileName={elkGraph.fileName}
        direction={elkGraph.direction}
        infoRef={infoRef}
        onSetDirection={dir => {
          dispatch({ type: 'ELK_SET_DIRECTION', direction: dir });
        }}
        onExpandAll={() => dispatch({ type: 'ELK_SET_COLLAPSED', collapsed: new Set() })}
        onCollapseDepth2={() => {
          if (elkGraph.astNode) {
            assignASTIds(elkGraph.astNode, 'n0');
            dispatch({ type: 'ELK_SET_COLLAPSED', collapsed: computeDepthCollapse(elkGraph.astNode, 2) });
          }
        }}
        onSmartCollapse={() => {
          if (elkGraph.astNode) {
            assignASTIds(elkGraph.astNode, 'n0');
            dispatch({ type: 'ELK_SET_COLLAPSED', collapsed: computeSmartCollapse(elkGraph.astNode) });
          }
        }}
        onOutlineMode={() => {
          if (elkGraph.astNode) {
            assignASTIds(elkGraph.astNode, 'n0');
            dispatch({ type: 'ELK_SET_COLLAPSED', collapsed: computeOutlineCollapse(elkGraph.astNode) });
          }
        }}
        onFitView={fitView}
        onClose={() => dispatch({ type: 'CLOSE_ELK_GRAPH' })}
      />
      <div id="ast-graph-container" ref={containerRef}>
        {detailNode && (
          <ELKGraphDetail
            node={detailNode.node}
            label={detailNode.label}
            onClose={handleHideDetail}
          />
        )}
        <div id="ast-graph-legend">
          <div className="ag-leg-item"><div className="ag-leg-dot" style={{ background: 'rgba(79,142,247,0.2)', borderColor: 'var(--blue)' }} />Declaration</div>
          <div className="ag-leg-item"><div className="ag-leg-dot" style={{ background: 'rgba(167,139,250,0.2)', borderColor: 'var(--purple)' }} />Statement</div>
          <div className="ag-leg-item"><div className="ag-leg-dot" style={{ background: 'rgba(251,191,36,0.2)', borderColor: 'var(--yellow)' }} />Expression</div>
          <div className="ag-leg-item"><div className="ag-leg-dot" style={{ background: 'rgba(251,146,60,0.2)', borderColor: 'var(--orange)' }} />Literal</div>
          <div className="ag-leg-item"><div className="ag-leg-dot" style={{ background: 'rgba(34,211,238,0.2)', borderColor: 'var(--cyan)' }} />Type</div>
          <div className="ag-leg-item"><div className="ag-leg-dot" style={{ background: 'rgba(138,148,168,0.2)', borderColor: 'var(--text2)' }} />Other</div>
          <div style={{ marginLeft: 8, fontSize: 9, color: 'var(--text2)', opacity: 0.5 }}>
            Click=inspect &middot; Dbl-click=collapse
          </div>
        </div>
      </div>
    </div>
  );
}
