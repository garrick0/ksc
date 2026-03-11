function LegDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="leg-item">
      <div className="leg-dot" style={{ background: color }} />
      {label}
    </div>
  );
}

export function Toolbar() {
  return (
    <div id="toolbar">
      <div className="spacer" />
      <div className="legend">
        <LegDot color="var(--blue)" label="Declaration" />
        <LegDot color="var(--purple)" label="Statement" />
        <LegDot color="var(--yellow)" label="Expression" />
        <LegDot color="var(--orange)" label="Literal" />
        <LegDot color="var(--cyan)" label="Type" />
        <LegDot color="var(--text2)" label="Other" />
      </div>
    </div>
  );
}
