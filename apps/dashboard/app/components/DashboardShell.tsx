import { useEffect } from 'react';
import { useDashboardState, useDashboardDispatch } from '../state/context';
import { Header } from './Header';
import { Toolbar } from './Toolbar';
import { StatusBar } from './StatusBar';
import { UploadOverlay } from './UploadOverlay';
import { Sidebar } from './Sidebar/Sidebar';
import { TreeView } from './TreeView/TreeView';
import { DetailPanel } from './DetailPanel/DetailPanel';
import { Tooltip } from './Tooltip';
import { ELKGraphModal } from './ELKGraph/ELKGraphModal';
import { SAMPLE_DATA } from '../sampleData';

export function DashboardShell() {
  const state = useDashboardState();
  const dispatch = useDashboardDispatch();

  // Try loading data from /__data__ endpoint on mount; fall back to sample data
  useEffect(() => {
    fetch('/__data__')
      .then(r => {
        if (r.ok) return r.json();
        throw new Error('no data endpoint');
      })
      .then(data => dispatch({ type: 'LOAD_DATA', data }))
      .catch(() => {
        dispatch({ type: 'LOAD_DATA', data: SAMPLE_DATA });
      });
  }, [dispatch]);

  return (
    <>
      <Header />
      <div id="main">
        <Sidebar />
        <div id="content">
          <Toolbar />
          <TreeView />
          <DetailPanel />
        </div>
      </div>
      <StatusBar />
      <Tooltip />
      {state.uploadOverlayOpen && <UploadOverlay />}
      {state.elkGraph.open && <ELKGraphModal />}
    </>
  );
}
