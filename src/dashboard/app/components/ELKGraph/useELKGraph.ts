import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { ASTNode } from '../../types';
import { buildELKGraph, countDescendants, countVisibleNodes, type ELKNodeData } from './elkHelpers';
import { escHtml } from '../../utils/helpers';
import type { TooltipInfo } from '../../hooks/useTooltip';

const elk = new ELK();

interface Opts {
  astNode: ASTNode;
  collapsedNodes: Set<string>;
  direction: 'RIGHT' | 'DOWN';
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onToggleCollapse: (id: string) => void;
  showTooltip: (e: MouseEvent, info: TooltipInfo) => void;
  hideTooltip: () => void;
  onShowDetail: (node: ELKNodeData, label: string) => void;
  onHideDetail: () => void;
  infoRef: React.RefObject<HTMLDivElement | null>;
}

export function useELKGraph(containerRef: React.RefObject<HTMLDivElement | null>, opts: Opts) {
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const prevPosRef = useRef<Record<string, { x: number; y: number }>>({});
  const savedTransformRef = useRef<d3.ZoomTransform | null>(null);

  const render = useCallback(async () => {
    const container = containerRef.current;
    if (!container || !opts.astNode) return;

    // Save transform
    const oldSvg = container.querySelector('svg');
    if (oldSvg && zoomRef.current) {
      savedTransformRef.current = d3.zoomTransform(oldSvg as SVGSVGElement);
    }

    // Save positions
    if (oldSvg) {
      prevPosRef.current = {};
      oldSvg.querySelectorAll('g.elk-nodes > g').forEach(g => {
        const nodeId = g.getAttribute('data-node-id');
        if (nodeId) {
          const t = g.getAttribute('transform');
          const match = t?.match(/translate\(([\d.]+),([\d.]+)\)/);
          if (match) prevPosRef.current[nodeId] = { x: parseFloat(match[1]), y: parseFloat(match[2]) };
        }
      });
      oldSvg.remove();
    }

    const graph = buildELKGraph(opts.astNode, opts.collapsedNodes, opts.direction);

    // Update info
    if (opts.infoRef.current) {
      const totalNodes = countDescendants(opts.astNode) + 1;
      const visibleNodes = countVisibleNodes(opts.astNode, opts.collapsedNodes);
      opts.infoRef.current.innerHTML =
        `<span>Visible: <strong style="color:var(--text3)">${visibleNodes}</strong></span>` +
        `<span>Total: <strong style="color:var(--text3)">${totalNodes}</strong></span>` +
        `<span>Collapsed: <strong style="color:var(--text3)">${opts.collapsedNodes.size}</strong></span>`;
    }

    try {
      const layout = await elk.layout(graph as any);
      renderSVG(layout, container);
    } catch (err: any) {
      container.innerHTML += `<div style="padding:20px;color:var(--red)">Layout error: ${escHtml(err.message)}</div>`;
    }
  }, [opts.astNode, opts.collapsedNodes, opts.direction, opts.selectedNodeId]); // eslint-disable-line

  function renderSVG(layout: any, container: HTMLDivElement) {
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;
    const padding = 80;
    const totalW = (layout.width || 800) + padding * 2;
    const totalH = (layout.height || 600) + padding * 2;
    const hasOld = Object.keys(prevPosRef.current).length > 0;
    const ANIM_DUR = 400;

    const svg = d3.select(container).append('svg')
      .attr('width', containerW)
      .attr('height', containerH);

    const g = svg.append('g');

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 5])
      .on('zoom', e => g.attr('transform', e.transform));
    svg.call(zoomBehavior);
    zoomRef.current = zoomBehavior;

    if (savedTransformRef.current && hasOld) {
      svg.call(zoomBehavior.transform, savedTransformRef.current);
    } else {
      const scale = Math.min(containerW / totalW, containerH / totalH, 1) * 0.9;
      const tx = (containerW - totalW * scale) / 2 + padding * scale;
      const ty = (containerH - totalH * scale) / 2 + padding * scale;
      svg.call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    }

    // Arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'elk-arrow')
      .attr('viewBox', '0 0 8 6')
      .attr('refX', 8).attr('refY', 3)
      .attr('markerWidth', 8).attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,0 L8,3 L0,6 Z')
      .attr('fill', '#3a4560');

    // Edges
    if (layout.edges) {
      const edgeGroup = g.append('g').attr('class', 'elk-edges');
      layout.edges.forEach((edge: any) => {
        if (!edge.sections) return;
        edge.sections.forEach((section: any) => {
          let pathD = `M${section.startPoint.x},${section.startPoint.y}`;
          if (section.bendPoints) {
            section.bendPoints.forEach((bp: any) => { pathD += ` L${bp.x},${bp.y}`; });
          }
          pathD += ` L${section.endPoint.x},${section.endPoint.y}`;

          const edgePath = edgeGroup.append('path')
            .attr('fill', 'none')
            .attr('stroke', '#2a3347')
            .attr('stroke-width', 1.5)
            .attr('marker-end', 'url(#elk-arrow)');

          if (hasOld) {
            edgePath.attr('d', pathD).attr('opacity', 0)
              .transition().duration(ANIM_DUR).attr('opacity', 1);
          } else {
            edgePath.attr('d', pathD);
          }
        });
      });
    }

    // Nodes
    if (layout.children) {
      const nodeGroup = g.append('g').attr('class', 'elk-nodes');
      layout.children.forEach((node: any) => {
        const ng = nodeGroup.append('g')
          .attr('data-node-id', node.id)
          .style('cursor', 'pointer');

        const color = node._color || '#2a3347';
        const isSelected = node.id === opts.selectedNodeId;
        const label = node.labels?.[0]?.text ?? '';

        // Animation from previous position
        let startX = node.x, startY = node.y;
        if (hasOld) {
          if (prevPosRef.current[node.id]) {
            startX = prevPosRef.current[node.id].x;
            startY = prevPosRef.current[node.id].y;
          } else {
            const pp = findParentPosition(node._astNode, prevPosRef.current);
            if (pp) { startX = pp.x; startY = pp.y; }
          }
        }

        ng.attr('transform', `translate(${startX},${startY})`);
        if (hasOld && (startX !== node.x || startY !== node.y)) {
          ng.transition().duration(ANIM_DUR).ease(d3.easeCubicOut)
            .attr('transform', `translate(${node.x},${node.y})`);
        }
        if (hasOld && !prevPosRef.current[node.id]) {
          ng.attr('opacity', 0).transition().duration(ANIM_DUR).attr('opacity', 1);
        }

        // Rect
        ng.append('rect')
          .attr('width', node.width).attr('height', node.height)
          .attr('rx', 5)
          .attr('fill', color).attr('fill-opacity', 0.15)
          .attr('stroke', isSelected ? '#e4e8f0' : color)
          .attr('stroke-width', isSelected ? 2.5 : 1.5)
          .attr('stroke-opacity', isSelected ? 1 : 0.8);

        // Left accent
        ng.append('rect')
          .attr('width', 3).attr('height', node.height)
          .attr('rx', 1.5).attr('fill', color).attr('fill-opacity', 0.6);

        // Label
        const maxChars = Math.floor((node.width - 16) / 7);
        const displayLabel = label.length > maxChars ? label.slice(0, maxChars - 2) + '..' : label;
        ng.append('text')
          .attr('x', 10).attr('y', node.height / 2).attr('dy', '0.35em')
          .attr('fill', '#e4e8f0').attr('font-size', '11px')
          .attr('font-family', '-apple-system,BlinkMacSystemFont,sans-serif')
          .text(displayLabel);

        // Collapse badge
        if (node._isCollapsed && node._childCount > 0) {
          const badgeText = '+' + node._childCount;
          const badgeW = badgeText.length * 6.5 + 8;
          ng.append('rect')
            .attr('x', node.width - badgeW - 4).attr('y', (node.height - 16) / 2)
            .attr('width', badgeW).attr('height', 16).attr('rx', 3)
            .attr('fill', 'rgba(124,106,247,0.25)')
            .attr('stroke', '#7c6af7').attr('stroke-width', 0.5);
          ng.append('text')
            .attr('x', node.width - badgeW).attr('y', node.height / 2).attr('dy', '0.35em')
            .attr('fill', '#a78bfa').attr('font-size', '9px').attr('font-weight', '700')
            .text(badgeText);
        }

        if (node._hasChildren && !node._isCollapsed) {
          ng.append('text')
            .attr('x', node.width - 14).attr('y', node.height / 2).attr('dy', '0.35em')
            .attr('fill', '#3a4560').attr('font-size', '10px').attr('text-anchor', 'middle')
            .text('\u25BE');
        }

        // Click
        ng.on('click', (e: MouseEvent) => {
          e.stopPropagation();
          opts.onSelectNode(node.id);
          opts.onShowDetail(node, label);
        });
        ng.attr('data-color', color);

        // Double-click
        if (node._hasChildren) {
          ng.on('dblclick', (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            opts.onToggleCollapse(node.id);
          });
        }

        // Hover
        ng.on('mouseenter.stroke', function() {
          if (node.id !== opts.selectedNodeId)
            d3.select(this).select('rect').attr('stroke-width', 2.5).attr('stroke-opacity', 1);
        });
        ng.on('mouseleave.stroke', function() {
          if (node.id !== opts.selectedNodeId)
            d3.select(this).select('rect').attr('stroke-width', 1.5).attr('stroke-opacity', 0.8);
        });
        ng.on('mousemove.tooltip', (e: MouseEvent) => {
          const astN = node._astNode;
          const rows: [string, string][] = [['Kind', astN.kind]];
          if (astN.name) rows.push(['Name', astN.name]);
          rows.push(['Pos', astN.pos + ' \u2014 ' + astN.end]);
          if (astN.children?.length > 0) rows.push(['Children', astN.children.length + '']);
          if (node._isCollapsed) rows.push(['Hidden', node._childCount + ' descendants']);
          opts.showTooltip(e, { title: label, rows });
        });
        ng.on('mouseleave.tooltip', () => opts.hideTooltip());
      });
    }

    // Background click = deselect
    svg.on('click', () => {
      opts.onSelectNode(null);
      opts.onHideDetail();
    });
  }

  useEffect(() => {
    render();
  }, [render]);

  return {
    fitView: () => {
      const container = containerRef.current;
      const svgEl = container?.querySelector('svg');
      if (!svgEl || !zoomRef.current) return;

      const svgSel = d3.select(svgEl as SVGSVGElement);
      const gNode = svgEl.querySelector('g');
      if (!gNode) return;

      const bbox = gNode.getBBox();
      const cW = container!.clientWidth, cH = container!.clientHeight;
      const pad = 80;
      const tW = bbox.width + pad * 2, tH = bbox.height + pad * 2;
      const scale = Math.min(cW / tW, cH / tH, 1) * 0.9;
      const tx = (cW - bbox.width * scale) / 2 - bbox.x * scale;
      const ty = (cH - bbox.height * scale) / 2 - bbox.y * scale;

      svgSel.transition().duration(500)
        .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    },
  };
}

function findParentPosition(astNode: ASTNode, prev: Record<string, { x: number; y: number }>) {
  const id = (astNode as any)._elkId as string;
  if (!id) return null;
  const parts = id.split('-');
  while (parts.length > 1) {
    parts.pop();
    const parentId = parts.join('-');
    if (prev[parentId]) return prev[parentId];
  }
  return null;
}
