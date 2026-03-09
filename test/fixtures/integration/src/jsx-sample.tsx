// JSX syntax coverage

declare namespace JSX {
  interface Element {}
  interface IntrinsicElements {
    div: { className?: string; id?: string; onClick?: () => void; children?: any };
    span: { style?: Record<string, string>; children?: any };
    input: { type?: string; value?: string; disabled?: boolean };
    br: {};
    img: { src: string; alt?: string };
  }
}

// Simple JSX element
export function Greeting({ name }: { name: string }) {
  return <div className="greeting">Hello, {name}!</div>;
}

// JSX with attributes, expressions, self-closing
export function Form({ onSubmit }: { onSubmit: () => void }) {
  const label = 'Submit';
  return (
    <div id="form">
      <span style={{ color: 'red' }}>{label}</span>
      <input type="text" value="default" />
      <br />
      <img src="logo.png" alt="Logo" />
      <div onClick={() => onSubmit()}>
        {label.length > 0 ? <span>Click</span> : <span>Wait</span>}
      </div>
    </div>
  );
}

// JSX fragment
export function Fragment() {
  return (
    <>
      <div>First</div>
      <div>Second</div>
    </>
  );
}

// JSX spread attributes
export function Spread(props: { className: string; id: string }) {
  return <div {...props}>Spread</div>;
}
