import { useDashboardState, useDashboardDispatch } from '../../state/context';
import { SidebarGroup } from './SidebarGroup';
import { SidebarItem } from './SidebarItem';
import { shortFileName } from '../../utils/helpers';

export function Sidebar() {
  const { data, searchQuery, selectedFileName } = useDashboardState();
  const dispatch = useDashboardDispatch();

  return (
    <div id="sidebar">
      <div id="sidebar-search">
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={e => dispatch({ type: 'SET_SEARCH_QUERY', query: e.target.value })}
        />
      </div>
      <div id="sidebar-content">
        {data && data.files
          .filter(f => !searchQuery || f.fileName.toLowerCase().includes(searchQuery.toLowerCase()))
          .map(f => (
            <SidebarItem
              key={f.fileName}
              id={f.fileName}
              dotColor="var(--parse-color)"
              name={shortFileName(f.fileName)}
              trailing={<span className="count">{f.lineCount} lines</span>}
              onClick={() => dispatch({ type: 'SELECT_FILE', fileName: f.fileName })}
            />
          ))}
      </div>
    </div>
  );
}
