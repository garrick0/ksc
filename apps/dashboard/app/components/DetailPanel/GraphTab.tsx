import { useRef, useCallback, useState } from 'react';
import { useDashboardDispatch } from '../../state/context';
import { useELKGraph } from '../ELKGraph/useELKGraph';
import { useTooltip } from '../../hooks/useTooltip';
import { assignASTIds, computeSmartCollapse, computeDepthCollapse, computeOutlineCollapse, type ELKNodeData } from '../ELKGraph/elkHelpers';
import { ELKGraphDetail } from '../ELKGraph/ELKGraphDetail';
import type { ASTNode } from '../../types';

interface Props {
  astNode: ASTNode;
  fileName: string;
}

export function GraphTab({ astNode, fileName }: Props) {
  const dispatch = useDashboardDispatch();
  const { show, hide } = useTooltip();
  const containerRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const [detailNode, setDetailNode] = useState<{ node: ELKNodeData; label: string } | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(() => {
    assignASTIds(astNode, 'n0');
    return computeSmartCollapse(astNode);
  });
  const [direction, setDirection] = useState<'RIGHT' | 'DOWN'>('RIGHT');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  assignASTIds(astNode, 'n0');

  const handleSelectNode = useCallback((id: string | null) => {
    setSelectedNodeId(id);
  }, []);

  const handleToggleCollapse = useCallback((id: string) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleShowDetail = useCallback((node: ELKNodeData, label: string) => {
    setDetailNode({ node, label });
  }, []);

  const handleHideDetail = useCallback(() => {
    setDetailNode(null);
  }, []);

  const { fitView } = useELKGraph(containerRef, {
    astNode,
    collapsedNodes,
    direction,
    selectedNodeId,
    onSelectNode: handleSelectNode,
    onToggleCollapse: handleToggleCollapse,
    showTooltip: show,
    hideTooltip: hide,
    onShowDetail: handleShowDetail,
    onHideDetail: handleHideDetail,
    infoRef,
  });

  return (
    <div className="graph-tab-wrap">
      <div className="graph-tab-toolbar">
        <div className="ag-info" ref={infoRef} />
        <button
          className={`ag-btn ${direction === 'RIGHT' ? 'active' : ''}`}
          onClick={() => setDirection('RIGHT')}
        >
          LR
        </button>
        <button
          className={`ag-btn ${direction === 'DOWN' ? 'active' : ''}`}
          onClick={() => setDirection('DOWN')}
        >
          TD
        </button>
        <div className="ag-sep" />
        <button className="ag-btn" onClick={() => setCollapsedNodes(new Set())}>All</button>
        <button className="ag-btn" onClick={() => {
          assignASTIds(astNode, 'n0');
          setCollapsedNodes(computeSmartCollapse(astNode));
        }}>Smart</button>
        <button className="ag-btn" onClick={() => {
          assignASTIds(astNode, 'n0');
          setCollapsedNodes(computeDepthCollapse(astNode, 2));
        }}>D2</button>
        <button className="ag-btn" onClick={() => {
          assignASTIds(astNode, 'n0');
          setCollapsedNodes(computeOutlineCollapse(astNode));
        }}>Out</button>
        <div className="ag-sep" />
        <button className="ag-btn" onClick={fitView}>Fit</button>
        <button
          className="ag-btn"
          title="Open fullscreen"
          onClick={() => dispatch({ type: 'OPEN_ELK_GRAPH', astNode, fileName })}
        >
          &#x26F6;
        </button>
      </div>
      <div className="graph-tab-container" ref={containerRef}>
        {detailNode && (
          <ELKGraphDetail
            node={detailNode.node}
            label={detailNode.label}
            onClose={handleHideDetail}
          />
        )}
      </div>
    </div>
  );
}
