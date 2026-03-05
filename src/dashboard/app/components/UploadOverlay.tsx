import { useRef } from 'react';
import { useDashboardDispatch } from '../state/context';

export function UploadOverlay() {
  const dispatch = useDashboardDispatch();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        dispatch({ type: 'LOAD_DATA', data });
      } catch (err) {
        console.error('Invalid JSON:', err);
      }
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        dispatch({ type: 'LOAD_DATA', data });
      } catch (err) {
        console.error('Invalid JSON:', err);
      }
    };
    reader.readAsText(file);
  }

  return (
    <div
      id="upload-overlay"
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div id="upload-box">
        <h2>Load Dashboard Data</h2>
        <p>
          Drop a <code>DashboardExportData</code> JSON file here, or click to browse.<br />
          Generate with: <code>ksc dashboard --output data.json</code>
        </p>
        <div className="btns">
          <button className="primary" onClick={() => inputRef.current?.click()}>
            Browse file...
          </button>
          <button onClick={() => dispatch({ type: 'SET_UPLOAD_OVERLAY', open: false })}>
            Cancel
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
      </div>
    </div>
  );
}
