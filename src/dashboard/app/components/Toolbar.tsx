import { useDashboardState, useDashboardDispatch } from '../state/context';
import type { CheckView } from '../types';

function LegDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="leg-item">
      <div className="leg-dot" style={{ background: color }} />
      {label}
    </div>
  );
}

export function Toolbar() {
  const { activeStage, checkView } = useDashboardState();
  const dispatch = useDashboardDispatch();

  function setView(v: CheckView) {
    dispatch({ type: 'SWITCH_CHECK_VIEW', view: v });
  }

  return (
    <div id="toolbar">
      {activeStage === 'check' && (
        <div className="view-btns">
          <button
            className={`view-btn ${checkView === 'byFile' ? 'active' : ''}`}
            onClick={() => setView('byFile')}
          >
            By File
          </button>
          <button
            className={`view-btn ${checkView === 'byProperty' ? 'active' : ''}`}
            onClick={() => setView('byProperty')}
          >
            By Property
          </button>
        </div>
      )}
      <div className="spacer" />
      <div className="legend">
        {activeStage === 'parse' && (
          <>
            <LegDot color="var(--cyan)" label="TypeAlias" />
            <LegDot color="var(--blue)" label="Variable" />
            <LegDot color="var(--yellow)" label="Function" />
            <LegDot color="var(--green)" label="Interface" />
          </>
        )}
        {activeStage === 'bind' && (
          <>
            <LegDot color="var(--blue)" label="Definition" />
            <LegDot color="var(--cyan)" label="Annotation" />
          </>
        )}
        {activeStage === 'check' && (
          <>
            <LegDot color="var(--green)" label="Clean" />
            <LegDot color="var(--red)" label="Violation" />
          </>
        )}
      </div>
    </div>
  );
}
