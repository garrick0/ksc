import { DashboardProvider } from './state/context';
import { DashboardShell } from './components/DashboardShell';

export function App() {
  return (
    <DashboardProvider>
      <DashboardShell />
    </DashboardProvider>
  );
}
