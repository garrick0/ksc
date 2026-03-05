import { useDashboardState, useDashboardDispatch } from '../../state/context';
import { SidebarGroup } from './SidebarGroup';
import { SidebarItem } from './SidebarItem';
import { shortFileName, kindColor, kindBadge } from '../../utils/helpers';

export function ParseSidebar() {
  const { data, searchQuery } = useDashboardState();
  const dispatch = useDashboardDispatch();
  if (!data) return null;

  const query = searchQuery.toLowerCase();

  return (
    <>
      {data.parse.sourceFiles.map(sf => {
        if (query && !sf.fileName.toLowerCase().includes(query) &&
            !sf.declarations.some(d => d.name.toLowerCase().includes(query))) return null;

        const filteredDecls = sf.declarations.filter(d =>
          !query || d.name.toLowerCase().includes(query)
        );

        return (
          <SidebarGroup
            key={sf.fileName}
            header={shortFileName(sf.fileName)}
            count={sf.declarations.length}
            onHeaderAction={() => {
              dispatch({ type: 'SELECT_NODE', id: null });
              dispatch({ type: 'OPEN_DETAIL', detailType: 'fileViewer', payload: { fileName: sf.fileName } });
            }}
          >
            {filteredDecls.map(d => (
              <SidebarItem
                key={d.id}
                id={d.id}
                dotColor={kindColor(d.kind)}
                badge={kindBadge(d.kind)}
                badgeStyle={{ background: kindColor(d.kind), color: '#fff' }}
                name={d.name}
                onClick={() => {
                  dispatch({ type: 'SELECT_NODE', id: d.id });
                  dispatch({ type: 'OPEN_DETAIL', detailType: 'parseDetail', payload: { file: sf, decl: d } });
                }}
              />
            ))}
          </SidebarGroup>
        );
      })}
    </>
  );
}
