import { shortFileName } from '../../utils/helpers';

interface Props {
  fileName: string;
  direction: 'RIGHT' | 'DOWN';
  infoRef: React.RefObject<HTMLDivElement | null>;
  onSetDirection: (dir: 'RIGHT' | 'DOWN') => void;
  onExpandAll: () => void;
  onCollapseDepth2: () => void;
  onSmartCollapse: () => void;
  onOutlineMode: () => void;
  onFitView: () => void;
  onClose: () => void;
}

export function ELKGraphToolbar(props: Props) {
  return (
    <div id="ast-graph-toolbar">
      <span className="ag-title">AST Graph — {shortFileName(props.fileName)}</span>
      <div className="ag-info" ref={props.infoRef} />
      <div className="ag-sep" />
      <button
        className={`ag-btn ${props.direction === 'RIGHT' ? 'active' : ''}`}
        onClick={() => props.onSetDirection('RIGHT')}
      >
        LR
      </button>
      <button
        className={`ag-btn ${props.direction === 'DOWN' ? 'active' : ''}`}
        onClick={() => props.onSetDirection('DOWN')}
      >
        TD
      </button>
      <div className="ag-sep" />
      <button className="ag-btn" onClick={props.onExpandAll}>Expand All</button>
      <button className="ag-btn" onClick={props.onCollapseDepth2}>Depth 2+</button>
      <button className="ag-btn" onClick={props.onSmartCollapse}>Smart</button>
      <button className="ag-btn" onClick={props.onOutlineMode}>Outline</button>
      <div className="ag-sep" />
      <button className="ag-btn" onClick={props.onFitView}>Fit View</button>
      <button className="ag-btn" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={props.onClose}>
        &times; Close
      </button>
    </div>
  );
}
