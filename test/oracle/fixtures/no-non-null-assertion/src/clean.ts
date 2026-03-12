// no-non-null-assertion: clean
const x: string | undefined = 'hello';
const y = x ?? '';
if (x) { x.length; }
