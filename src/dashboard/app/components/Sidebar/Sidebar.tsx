import { useDashboardState, useDashboardDispatch } from '../../state/context';
import { ParseSidebar } from './ParseSidebar';
import { KindsSidebar } from './KindsSidebar';
import { CheckSidebar } from './CheckSidebar';

export function Sidebar() {
  const { activeStage, searchQuery } = useDashboardState();
  const dispatch = useDashboardDispatch();

  return (
    <div id="sidebar">
      <div id="sidebar-search">
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={e => dispatch({ type: 'SET_SEARCH_QUERY', query: e.target.value })}
        />
      </div>
      <div id="sidebar-content">
        {activeStage === 'parse' && <ParseSidebar />}
        {activeStage === 'bind' && <KindsSidebar />}
        {activeStage === 'check' && <CheckSidebar />}
      </div>
    </div>
  );
}
