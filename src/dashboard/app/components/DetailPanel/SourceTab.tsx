import { highlightTS } from '../../utils/helpers';

interface Props {
  source: string;
  violationLines: Set<number>;
}

export function SourceTab({ source, violationLines }: Props) {
  const lines = source.split('\n');
  return (
    <div className="fv-code-wrap">
      {lines.map((line, i) => {
        const lineNum = i + 1;
        const isViolation = violationLines.has(lineNum);
        return (
          <div key={i} className={`fv-line ${isViolation ? 'violation' : ''}`}>
            <span className="fv-ln">{lineNum}</span>
            <span className="fv-code" dangerouslySetInnerHTML={{ __html: highlightTS(line) }} />
          </div>
        );
      })}
    </div>
  );
}
