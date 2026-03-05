import { useCallback, useRef } from 'react';

export interface TooltipInfo {
  title: string;
  rows?: [string, string][];
  props?: string[];
}

export function useTooltip() {
  const elRef = useRef<HTMLDivElement | null>(null);

  const show = useCallback((event: MouseEvent | React.MouseEvent, info: TooltipInfo) => {
    const tt = elRef.current ?? document.getElementById('tooltip') as HTMLDivElement;
    if (!tt) return;
    elRef.current = tt;

    let html = `<div class="tt-title">${escH(info.title)}</div>`;
    (info.rows ?? []).forEach(r => {
      html += `<div class="tt-row"><span class="tt-key">${r[0]}</span><span class="tt-val">${escH(r[1])}</span></div>`;
    });
    if (info.props && info.props.length > 0) {
      html += '<div class="tt-props">';
      info.props.forEach(p => {
        html += `<span class="tt-chip" style="background:rgba(74,222,128,0.12);color:#4ade80">${p}</span>`;
      });
      html += '</div>';
    }
    tt.innerHTML = html;
    tt.style.display = 'block';
    const x = Math.min(event.clientX + 12, window.innerWidth - 360);
    const y = Math.min(event.clientY + 12, window.innerHeight - 200);
    tt.style.left = x + 'px';
    tt.style.top = y + 'px';
  }, []);

  const hide = useCallback(() => {
    const tt = elRef.current ?? document.getElementById('tooltip') as HTMLDivElement;
    if (tt) tt.style.display = 'none';
    elRef.current = tt;
  }, []);

  return { show, hide };
}

function escH(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
