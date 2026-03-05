import { useDashboardState, useDashboardDispatch } from '../../state/context';
import { SidebarGroup } from './SidebarGroup';
import { SidebarItem } from './SidebarItem';
import { escHtml } from '../../utils/helpers';

export function KindsSidebar() {
  const { data, searchQuery } = useDashboardState();
  const dispatch = useDashboardDispatch();
  if (!data) return null;

  const query = searchQuery.toLowerCase();
  const defs = data.kinds.definitions;
  const anns = data.kinds.annotations;

  const filteredDefs = defs.filter(d =>
    !query || d.name.toLowerCase().includes(query) ||
    Object.keys(d.properties).some(k => k.toLowerCase().includes(query))
  );

  const filteredAnns = anns.filter(a =>
    !query || a.name.toLowerCase().includes(query) || a.kindName.toLowerCase().includes(query)
  );

  return (
    <>
      {filteredDefs.length > 0 && (
        <SidebarGroup header="Definitions" count={filteredDefs.length}>
          {filteredDefs.map(d => (
            <SidebarItem
              key={d.id}
              id={d.id}
              dotColor="var(--blue)"
              badge="DEF"
              badgeStyle={{ background: 'var(--blue)', color: '#fff' }}
              name={d.name}
              trailing={<PropsChips properties={d.properties} />}
              onClick={() => {
                dispatch({ type: 'SELECT_NODE', id: d.id });
                dispatch({ type: 'OPEN_DETAIL', detailType: 'kindsDetail', payload: { item: d, kind: 'definition' } });
              }}
            />
          ))}
        </SidebarGroup>
      )}
      {filteredAnns.length > 0 && (
        <SidebarGroup header="Annotations" count={filteredAnns.length}>
          {filteredAnns.map(a => (
            <SidebarItem
              key={a.id}
              id={a.id}
              dotColor="var(--cyan)"
              badge="ANN"
              badgeStyle={{ background: 'var(--cyan)', color: '#000' }}
              name={a.name}
              trailing={
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '0 4px', borderRadius: 3,
                  background: 'rgba(79,142,247,0.1)', color: 'var(--blue)', marginLeft: 3,
                }}>
                  {a.kindName}
                </span>
              }
              onClick={() => {
                dispatch({ type: 'SELECT_NODE', id: a.id });
                dispatch({ type: 'OPEN_DETAIL', detailType: 'kindsDetail', payload: { item: a, kind: 'annotation' } });
              }}
            />
          ))}
        </SidebarGroup>
      )}
    </>
  );
}

function PropsChips({ properties }: { properties: Record<string, unknown> }) {
  const keys = Object.keys(properties).filter(k => properties[k]);
  if (keys.length === 0) return null;
  return (
    <>
      {keys.map(k => (
        <span key={k} style={{
          fontSize: 9, fontWeight: 700, padding: '0 4px', borderRadius: 3,
          background: 'rgba(74,222,128,0.1)', color: '#4ade80', marginLeft: 3,
        }}>
          {k}
        </span>
      ))}
    </>
  );
}
