import { useEffect, useRef, type Dispatch } from 'react';
import * as d3 from 'd3';
import type { TreeNodeData } from './treeBuilders';
import type { Action } from '../../state/actions';
import type { TooltipInfo } from '../../hooks/useTooltip';

interface Opts {
  treeData: TreeNodeData;
  dispatch: Dispatch<Action>;
  showTooltip: (e: MouseEvent, info: TooltipInfo) => void;
  hideTooltip: () => void;
}

interface D3Node extends d3.HierarchyNode<TreeNodeData> {
  _uid?: number;
  x0?: number;
  y0?: number;
  _children?: D3Node[] | null;
}

export function useD3Tree(containerRef: React.RefObject<HTMLDivElement | null>, opts: Opts | null) {
  const uidRef = useRef(0);

  useEffect(() => {
    const panel = containerRef.current;
    if (!panel || !opts) return;
    const o = opts; // narrowed non-null for closures below
    const W = panel.clientWidth, H = panel.clientHeight;
    if (W === 0 || H === 0) return;

    panel.innerHTML = '';
    uidRef.current = 0;

    const root = d3.hierarchy(opts.treeData) as D3Node;
    root.each((d: D3Node) => { d._uid = ++uidRef.current; });

    // Auto-collapse depth >= 3
    root.each((d: D3Node) => {
      if (d.children && d.depth >= 3) {
        d._children = d.children as D3Node[];
        d.children = null!;
      }
    });

    const nodeH = 28;
    const levelW = 200;
    const margin = { top: 40, left: 80, right: 40, bottom: 40 };
    const svgW = Math.max(W, 4000), svgH = Math.max(H, 4000);

    const svg = d3.select(panel).append('svg')
      .attr('width', svgW).attr('height', svgH)
      .style('font-family', '-apple-system,sans-serif');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.15, 3])
      .on('zoom', e => g.attr('transform', e.transform));
    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity.translate(margin.left, margin.top));

    const treeLay = d3.tree<TreeNodeData>().nodeSize([nodeH, levelW]);

    function linkPath(s: { x: number; y: number }, t: { x: number; y: number }) {
      return `M${s.y},${s.x}C${(s.y + t.y) / 2},${s.x} ${(s.y + t.y) / 2},${t.x} ${t.y},${t.x}`;
    }

    function update(source: D3Node) {
      treeLay(root as any);
      const nodes = root.descendants() as D3Node[];
      const links = root.links() as d3.HierarchyLink<TreeNodeData>[];

      // Links
      const link = g.selectAll<SVGPathElement, d3.HierarchyLink<TreeNodeData>>('path.tree-link')
        .data(links, (d: any) => d.target._uid);
      const linkEnter = link.enter().insert('path', 'g')
        .attr('class', 'tree-link')
        .attr('d', () => {
          const o = { x: source.x0 ?? source.x!, y: source.y0 ?? source.y! };
          return linkPath(o, o);
        });
      linkEnter.merge(link).transition().duration(350).attr('d', (d: any) => linkPath(d.source, d.target));
      link.exit().transition().duration(350).attr('d', () => {
        const o = { x: source.x!, y: source.y! };
        return linkPath(o, o);
      }).remove();

      // Nodes
      const node = g.selectAll<SVGGElement, D3Node>('g.tree-node')
        .data(nodes, (d: D3Node) => d._uid!);

      const nodeEnter = node.enter().append('g')
        .attr('class', 'tree-node')
        .attr('transform', () => {
          const sx = source.x0 ?? source.x!;
          const sy = source.y0 ?? source.y!;
          return `translate(${sy},${sx})`;
        });

      // Bg rect
      nodeEnter.append('rect')
        .attr('class', 'tree-node-bg')
        .attr('x', -4).attr('y', -nodeH / 2)
        .attr('width', levelW - 10).attr('height', nodeH)
        .attr('rx', 3);

      // Toggle arrow
      nodeEnter.filter(d => !!(d.data.children && d.data.children.length > 0) || !!d.children || !!d._children)
        .append('text')
        .attr('class', 'tree-toggle')
        .attr('x', -14).attr('dy', '0.35em').attr('text-anchor', 'middle')
        .on('click', (e: MouseEvent, d: D3Node) => {
          e.stopPropagation();
          if (d.children) { d._children = d.children as D3Node[]; d.children = null!; }
          else if (d._children) { d.children = d._children; d._children = null; }
          update(d);
        });

      // Node dot
      nodeEnter.append('circle')
        .attr('r', d => d.data._isGroup ? 6 : d.data._isFile || d.data._isDir ? 5 : 3.5)
        .attr('fill', d => d.data.color || '#4a5578')
        .attr('stroke', d => d.data.strokeColor || 'transparent')
        .attr('stroke-width', 1.5);

      // Badge
      nodeEnter.filter(d => !!d.data.badge)
        .append('rect')
        .attr('x', 8).attr('y', -7)
        .attr('width', d => (d.data.badge?.length ?? 0) * 6 + 6).attr('height', 14)
        .attr('rx', 2).attr('fill', d => d.data.badgeColor || '#555');
      nodeEnter.filter(d => !!d.data.badge)
        .append('text')
        .attr('class', 'tree-badge')
        .attr('x', 11).attr('dy', '0.35em')
        .attr('fill', '#fff')
        .text(d => d.data.badge!);

      // Label
      nodeEnter.append('text')
        .attr('class', d => 'tree-node-label' + (d.data._isGroup || d.data._isFile || d.data._isDir ? ' bold' : ''))
        .attr('x', d => d.data.badge ? (d.data.badge.length) * 6 + 18 : 10)
        .attr('dy', '0.35em')
        .text(d => {
          let name = d.data.name;
          if (name.length > 32) name = name.slice(0, 30) + '...';
          return name;
        });

      // Count
      nodeEnter.filter(d => !!d.data.countText)
        .append('text')
        .attr('class', 'tree-node-count')
        .attr('dy', '0.35em')
        .text(d => d.data.countText!);

      // Property chips
      nodeEnter.filter(d => !!(d.data.propChips && d.data.propChips.length > 0)).each(function(d) {
        const sel = d3.select(this);
        let xOff = (d.data.badge ? d.data.badge.length * 6 + 18 : 10) + (d.data.name.length > 32 ? 30 * 6.5 : d.data.name.length * 6.5) + 8;
        d.data.propChips!.forEach(chip => {
          sel.append('rect')
            .attr('x', xOff).attr('y', -6).attr('width', chip.length * 5.5 + 8).attr('height', 12)
            .attr('rx', 3).attr('fill', chip.color + '22').attr('stroke', chip.color).attr('stroke-width', 0.5);
          sel.append('text')
            .attr('class', 'tree-prop-chip')
            .attr('x', xOff + 4).attr('dy', '0.3em')
            .attr('fill', chip.color)
            .text(chip.label);
          xOff += chip.length * 5.5 + 12;
        });
      });

      // Click handler
      nodeEnter.on('click', (e: MouseEvent, d: D3Node) => {
        if (d.data.action && (d.data._isFile || d.data._isDir)) {
          handleAction(d.data.action);
          return;
        }
        if (d.children) { d._children = d.children as D3Node[]; d.children = null!; }
        else if (d._children) { d.children = d._children; d._children = null; }
        else {
          if (d.data.action) handleAction(d.data.action);
          return;
        }
        update(d);
      });

      // Hover
      nodeEnter.on('mousemove', (e: MouseEvent, d: D3Node) => {
        if (d.data.tooltip) o.showTooltip(e, d.data.tooltip);
      });
      nodeEnter.on('mouseleave', () => o.hideTooltip());

      // Update positions
      const nodeUpdate = nodeEnter.merge(node);
      nodeUpdate.transition().duration(350).attr('transform', (d: D3Node) => `translate(${d.y},${d.x})`);
      nodeUpdate.select('.tree-toggle').text((d: D3Node) => d.children ? '\u25BE' : '\u25B8');

      node.exit().transition().duration(350)
        .attr('transform', () => `translate(${source.y},${source.x})`)
        .remove();

      nodes.forEach(d => { d.x0 = d.x!; d.y0 = d.y!; });
    }

    function handleAction(action: { type: string; payload: unknown }) {
      if (action.type === 'SELECT_FILE') {
        const p = action.payload as { fileName: string };
        o.dispatch({ type: 'SELECT_FILE', fileName: p.fileName });
      } else {
        const payload = action.payload as { detailType: string; payload: unknown };
        o.dispatch({ type: 'OPEN_DETAIL', detailType: payload.detailType, payload: payload.payload });
      }
    }

    update(root);

    return () => { panel.innerHTML = ''; };
  }, [opts?.treeData]); // eslint-disable-line react-hooks/exhaustive-deps
}
