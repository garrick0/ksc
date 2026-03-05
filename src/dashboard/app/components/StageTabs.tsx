import { useDashboardState, useDashboardDispatch } from '../state/context';
import type { Stage } from '../types';

const STAGES: { key: Stage; label: string }[] = [
  { key: 'parse', label: 'PARSE' },
  { key: 'bind', label: 'KINDS' },
  { key: 'check', label: 'CHECK' },
];

export function StageTabs() {
  const { data, activeStage } = useDashboardState();
  const dispatch = useDashboardDispatch();

  function count(stage: Stage): number {
    if (!data) return 0;
    if (stage === 'parse') return data.parse.sourceFiles.length;
    if (stage === 'bind') return data.kinds.definitions.length;
    return data.check.diagnostics.length;
  }

  return (
    <div id="stage-tabs">
      {STAGES.map(s => (
        <div
          key={s.key}
          className={`stage-tab ${activeStage === s.key ? 'active' : ''}`}
          data-stage={s.key}
          onClick={() => dispatch({ type: 'SWITCH_STAGE', stage: s.key })}
        >
          <div className="tab-dot" />
          <span>{s.label}</span>
          <span className="tab-count">{count(s.key)}</span>
        </div>
      ))}
    </div>
  );
}
