import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';
import { dashboardReducer, initialState, type DashboardState } from './reducer';
import type { Action } from './actions';

const DashboardStateContext = createContext<DashboardState>(initialState);
const DashboardDispatchContext = createContext<Dispatch<Action>>(() => {});

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);
  return (
    <DashboardStateContext.Provider value={state}>
      <DashboardDispatchContext.Provider value={dispatch}>
        {children}
      </DashboardDispatchContext.Provider>
    </DashboardStateContext.Provider>
  );
}

export function useDashboardState(): DashboardState {
  return useContext(DashboardStateContext);
}

export function useDashboardDispatch(): Dispatch<Action> {
  return useContext(DashboardDispatchContext);
}
