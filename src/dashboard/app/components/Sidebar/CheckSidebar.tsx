import { useDashboardState, useDashboardDispatch } from '../../state/context';
import { SidebarGroup } from './SidebarGroup';
import { SidebarItem } from './SidebarItem';
import { shortFileName } from '../../utils/helpers';

export function CheckSidebar() {
  const { data, searchQuery } = useDashboardState();
  const dispatch = useDashboardDispatch();
  if (!data?.check) return <div style={{ padding: 16, color: 'var(--text2)' }}>No check data available</div>;

  const query = searchQuery.toLowerCase();

  // Group diagnostics by file
  const byFile: Record<string, typeof data.check.diagnostics> = {};
  data.check.diagnostics.forEach(d => {
    if (!byFile[d.file]) byFile[d.file] = [];
    byFile[d.file].push(d);
  });

  const diagFiles = new Set(data.check.diagnostics.map(d => d.file));
  const cleanFiles = data.parse.sourceFiles.filter(sf => !diagFiles.has(sf.fileName));

  return (
    <>
      {Object.entries(byFile).map(([file, diags]) => {
        if (query && !file.toLowerCase().includes(query) &&
            !diags.some(d => d.message.toLowerCase().includes(query))) return null;

        return (
          <SidebarGroup
            key={file}
            header={shortFileName(file)}
            count={diags.length}
            headerColor="var(--red)"
          >
            {diags.map(d => {
              if (query && !d.message.toLowerCase().includes(query) && !d.property.toLowerCase().includes(query)) return null;
              return (
                <SidebarItem
                  key={d.id}
                  id={d.id}
                  dotColor="var(--red)"
                  badge={`KS${d.code}`}
                  badgeStyle={{ background: 'rgba(248,113,113,0.15)', color: 'var(--red)' }}
                  name={d.property}
                  trailing={<span className="count">L{d.line}</span>}
                  onClick={() => {
                    dispatch({ type: 'SELECT_NODE', id: d.id });
                    dispatch({ type: 'OPEN_DETAIL', detailType: 'checkDetail', payload: d });
                  }}
                />
              );
            })}
          </SidebarGroup>
        );
      })}

      {cleanFiles.length > 0 && (
        <SidebarGroup
          header="Clean Files"
          count={cleanFiles.length}
          headerColor="var(--green)"
          defaultCollapsed
        >
          {cleanFiles.map(sf => (
            <SidebarItem
              key={sf.fileName}
              dotColor="var(--green)"
              name={shortFileName(sf.fileName)}
              trailing={<span className="count" style={{ color: 'var(--green)' }}>{'\u2713'}</span>}
              onClick={() => {
                dispatch({ type: 'OPEN_DETAIL', detailType: 'fileViewer', payload: { fileName: sf.fileName } });
              }}
            />
          ))}
        </SidebarGroup>
      )}
    </>
  );
}
