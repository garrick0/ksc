import { useRef, useMemo, useEffect, useState } from 'react';
import { useDashboardState, useDashboardDispatch } from '../../state/context';
import { useD3Tree } from './useD3Tree';
import { useTooltip } from '../../hooks/useTooltip';
import { buildParseTree, buildBindTree, buildCheckTreeByFile, buildCheckTreeByProperty } from './treeBuilders';

export function TreeView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, activeStage, checkView } = useDashboardState();
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
    if (activeStage === 'parse') return buildParseTree(data);
    if (activeStage === 'bind') return buildBindTree(data);
    return checkView === 'byFile' ? buildCheckTreeByFile(data) : buildCheckTreeByProperty(data);
  }, [data, activeStage, checkView]);

  useD3Tree(containerRef, {
    treeData: treeData!,
    dispatch,
    showTooltip: show,
    hideTooltip: hide,
  });

  return <div id="viz-panel" ref={containerRef} />;
}
