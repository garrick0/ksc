import type { DashboardExportData } from '../../types';
import { shortFileName, kindColor, kindBadge } from '../../utils/helpers';

export interface TreeNodeData {
  name: string;
  id?: string;
  color: string;
  strokeColor?: string;
  badge?: string | null;
  badgeColor?: string;
  countText?: string;
  _isGroup?: boolean;
  _isFile?: boolean;
  _isDir?: boolean;
  tooltip?: { title: string; rows: [string, string][]; props?: string[] };
  action?: { type: string; payload: unknown };
  propChips?: { label: string; length: number; color: string }[];
  children?: TreeNodeData[];
}

export function buildParseTree(data: DashboardExportData): TreeNodeData {
  return {
    name: 'Program',
    _isGroup: true,
    color: 'var(--parse-color)',
    tooltip: { title: 'Program', rows: [['Files', data.parse.sourceFiles.length + '']] },
    children: data.parse.sourceFiles.map(sf => ({
      name: shortFileName(sf.fileName),
      _isFile: true,
      color: 'var(--parse-color)',
      badge: null,
      countText: `(${sf.declarations.length} decls, ${sf.lineCount} lines)`,
      tooltip: { title: sf.fileName, rows: [['Lines', sf.lineCount + ''], ['Declarations', sf.declarations.length + '']] },
      action: { type: 'OPEN_DETAIL', payload: { detailType: 'fileViewer', payload: { fileName: sf.fileName } } },
      children: sf.declarations.map(d => ({
        id: d.id,
        name: d.name,
        color: kindColor(d.kind),
        badge: kindBadge(d.kind),
        badgeColor: kindColor(d.kind),
        tooltip: { title: d.name, rows: [['Kind', d.kind], ['Position', d.pos + ' \u2014 ' + d.end]] },
        action: { type: 'OPEN_DETAIL', payload: { detailType: 'parseDetail', payload: { file: sf, decl: d } } },
        children: [],
      })),
    })),
  };
}

export function buildBindTree(data: DashboardExportData): TreeNodeData {
  const defs = data.kinds.definitions;
  const anns = data.kinds.annotations;
  const annsByKind: Record<string, typeof anns> = {};
  anns.forEach(a => {
    if (!annsByKind[a.kindName]) annsByKind[a.kindName] = [];
    annsByKind[a.kindName].push(a);
  });

  return {
    name: 'Kinds',
    _isGroup: true,
    color: 'var(--bind-color)',
    tooltip: { title: 'Kinds', rows: [['Definitions', defs.length + ''], ['Annotations', anns.length + '']] },
    children: defs.map(def => {
      const defAnns = annsByKind[def.name] || [];
      return buildDefinitionNode(data, def, defAnns);
    }),
  };
}

function buildDefinitionNode(
  data: DashboardExportData,
  def: DashboardExportData['kinds']['definitions'][0],
  defAnns: DashboardExportData['kinds']['annotations'],
): TreeNodeData {
  const props = def.properties;
  const propKeys = Object.keys(props).filter(k => props[k]);
  const annFiles = new Set(defAnns.map(a => a.sourceFile));
  const hasDiags = data.check.diagnostics.some(d => annFiles.has(d.file));
  const chips = propKeys.map(p => ({
    label: p, length: p.length,
    color: hasDiags ? '#f87171' : '#4ade80',
  }));

  const rows: [string, string][] = [
    ['Type', 'Definition'],
    ['Source', shortFileName(def.sourceFile)],
    ['Properties', propKeys.join(', ') || 'none'],
    ['Annotations', defAnns.length + ''],
  ];

  return {
    id: def.id,
    name: def.name,
    color: '#4f8ef7',
    strokeColor: hasDiags ? 'var(--red)' : undefined,
    badge: 'DEF',
    badgeColor: '#4f8ef7',
    propChips: chips,
    tooltip: { title: def.name, rows, props: propKeys },
    action: { type: 'OPEN_DETAIL', payload: { detailType: 'kindsDetail', payload: { item: def, kind: 'definition' } } },
    children: defAnns.map(a => {
      const fileDiag = data.check.diagnostics.some(d => d.file === a.sourceFile);
      return {
        id: a.id,
        name: a.name,
        color: fileDiag ? 'var(--red)' : 'var(--cyan)',
        badge: 'ANN',
        badgeColor: '#22d3ee',
        tooltip: { title: a.name, rows: [['Kind', a.kindName], ['File', shortFileName(a.sourceFile)], ['Status', fileDiag ? 'Has violations' : 'Clean']] },
        action: { type: 'OPEN_DETAIL', payload: { detailType: 'kindsDetail', payload: { item: a, kind: 'annotation' } } },
        children: [],
      };
    }),
  };
}

export function buildCheckTreeByFile(data: DashboardExportData): TreeNodeData {
  const byFile: Record<string, DashboardExportData['check']['diagnostics']> = {};
  data.check.diagnostics.forEach(d => {
    if (!byFile[d.file]) byFile[d.file] = [];
    byFile[d.file].push(d);
  });
  const diagFiles = Object.keys(byFile);
  const cleanFiles = data.parse.sourceFiles.filter(sf => !byFile[sf.fileName]);

  return {
    name: `Diagnostics (${data.check.diagnostics.length} errors)`,
    _isGroup: true,
    color: data.check.diagnostics.length > 0 ? 'var(--red)' : 'var(--green)',
    tooltip: { title: 'Check Results', rows: [['Total', data.check.diagnostics.length + ''], ['Files with errors', diagFiles.length + ''], ['Clean files', cleanFiles.length + '']] },
    children: [
      ...diagFiles.map(file => ({
        name: shortFileName(file),
        _isFile: true,
        color: 'var(--red)',
        countText: `(${byFile[file].length} errors)`,
        tooltip: { title: file, rows: [['Errors', byFile[file].length + '']] as [string, string][] },
        action: { type: 'OPEN_DETAIL', payload: { detailType: 'fileViewer', payload: { fileName: file } } },
        children: byFile[file].map(d => ({
          id: d.id,
          name: `KS${d.code}: ${d.property}`,
          color: 'var(--red)',
          badge: `KS${d.code}`,
          badgeColor: '#dc2626',
          tooltip: { title: `KS${d.code}`, rows: [['Property', d.property], ['Line', d.line + ''], ['Message', d.message.slice(0, 80)]] as [string, string][] },
          action: { type: 'OPEN_DETAIL', payload: { detailType: 'checkDetail', payload: d } },
          children: [],
        })),
      })),
      ...(cleanFiles.length > 0 ? [{
        name: `Clean Files (${cleanFiles.length})`,
        _isGroup: true,
        color: 'var(--green)',
        children: cleanFiles.map(sf => ({
          name: shortFileName(sf.fileName),
          _isFile: true,
          color: 'var(--green)',
          badge: '\u2713',
          badgeColor: '#16a34a',
          tooltip: { title: sf.fileName, rows: [['Status', 'No violations']] as [string, string][] },
          action: { type: 'OPEN_DETAIL', payload: { detailType: 'fileViewer', payload: { fileName: sf.fileName } } },
          children: [],
        })),
      }] : []),
    ],
  };
}

export function buildCheckTreeByProperty(data: DashboardExportData): TreeNodeData {
  const byProp: Record<string, DashboardExportData['check']['diagnostics']> = {};
  data.check.diagnostics.forEach(d => {
    if (!byProp[d.property]) byProp[d.property] = [];
    byProp[d.property].push(d);
  });
  if (data.check.summary?.byProperty) {
    Object.keys(data.check.summary.byProperty).forEach(p => {
      if (!byProp[p]) byProp[p] = [];
    });
  }
  const propNames = Object.keys(byProp).sort();

  return {
    name: 'Check Results by Property',
    _isGroup: true,
    color: 'var(--check-color)',
    tooltip: { title: 'Property Check Results', rows: [['Properties checked', propNames.length + '']] },
    children: propNames.map(prop => {
      const diags = byProp[prop];
      const isClean = diags.length === 0;
      return {
        name: prop,
        _isGroup: true,
        color: isClean ? 'var(--green)' : 'var(--red)',
        countText: isClean ? '\u2713 clean' : `(${diags.length} violations)`,
        tooltip: { title: prop, rows: [['Violations', diags.length + '']] },
        children: diags.map(d => {
          const ann = data.kinds.annotations.find(a => a.sourceFile === d.file);
          return {
            id: d.id,
            name: `${ann ? ann.name : shortFileName(d.file)} \u2014 L${d.line}`,
            color: 'var(--red)',
            badge: `KS${d.code}`,
            badgeColor: '#dc2626',
            tooltip: { title: `KS${d.code}`, rows: [['File', d.file], ['Line', d.line + ''], ['Message', d.message.slice(0, 80)]] },
            action: { type: 'OPEN_DETAIL', payload: { detailType: 'checkDetail', payload: d } },
            children: [],
          };
        }),
      };
    }),
  };
}
