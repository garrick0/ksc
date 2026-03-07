export function escHtml(s: string | undefined | null): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function shortFileName(f: string | undefined | null): string {
  if (!f) return '';
  const parts = f.split('/');
  return parts.length <= 2 ? f : parts.slice(-2).join('/');
}

export function highlightTS(code: string): string {
  const re = /(\/\/[^\n]*)|('(?:[^'\\]|\\.)*')|(`(?:[^`\\]|\\.)*`)|("(?:[^"\\]|\\.)*")|\b(import|export|from|type|interface|class|function|const|let|var|return|if|else|for|of|in|new|readonly|extends|implements|private|public|protected|get|set|async|await|this|typeof|void|declare|as|while|switch|case|default|break|continue|throw|try|catch|finally|yield|null|undefined|static|abstract|enum)\b|\b(true|false|string|number|boolean|any|unknown|never|object|Record|Array|Map|Set|Promise|Partial|Required|Readonly|Pick|Omit)\b|\b([A-Z][A-Za-z0-9_]*)\b|(\b\d+(?:\.\d+)?\b)/g;
  let result = '', lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    if (m.index > lastIndex) result += escHtml(code.slice(lastIndex, m.index));
    const escaped = escHtml(m[0]);
    if (m[1] != null) result += `<span class="hl-cmt">${escaped}</span>`;
    else if (m[2] != null || m[3] != null || m[4] != null) result += `<span class="hl-str">${escaped}</span>`;
    else if (m[5] != null) result += `<span class="hl-kw">${escaped}</span>`;
    else if (m[6] != null) result += `<span class="hl-type">${escaped}</span>`;
    else if (m[7] != null) result += `<span class="hl-type">${escaped}</span>`;
    else if (m[8] != null) result += `<span class="hl-num">${escaped}</span>`;
    else result += escaped;
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < code.length) result += escHtml(code.slice(lastIndex));
  return result;
}

export function astKindColor(kind: string): string {
  if (/Declaration|Signature/.test(kind)) return 'var(--blue)';
  if (/Statement|Block|Clause|Case/.test(kind)) return 'var(--purple)';
  if (/Expression|Call|Arrow|Template|Spread|Yield|Await/.test(kind)) return 'var(--yellow)';
  if (/Literal|Keyword$/.test(kind) && /String|Numeric|True|False|Null|NoSubstitution|BigInt/.test(kind)) return 'var(--orange)';
  if (/Type|Union|Intersection|Mapped|Conditional|Indexed|Infer/.test(kind)) return 'var(--cyan)';
  if (/Import|Export/.test(kind)) return 'var(--text2)';
  if (kind === 'Identifier') return 'var(--text2)';
  return 'var(--text2)';
}
