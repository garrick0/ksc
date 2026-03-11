import { useRef, useMemo, useEffect, useState } from 'react';
import { useDashboardState, useDashboardDispatch } from '../../state/context';
import { useD3Tree } from './useD3Tree';
import { useTooltip } from '../../hooks/useTooltip';
import { buildASTTree } from './treeBuilders';

export function TreeView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { data } = useDashboardState();
  const dispatch = useDashboardDispatch();
  const { show, hide } = useTooltip();
  const [, setSize] = useState(0);

  // Re-render on resize
  useEffect(() => {
    const handler = () => setSize(s => s + 1);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const treeData = useMemo(() => {
    if (!data) return null;
    return buildASTTree(data);
  }, [data]);

  useD3Tree(containerRef, treeData ? {
    treeData,
    dispatch,
    showTooltip: show,
    hideTooltip: hide,
  } : null);

  return <div id="viz-panel" ref={containerRef} />;
}
