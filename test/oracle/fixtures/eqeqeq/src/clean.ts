// eqeqeq — clean: only === and !==

const a = 1;
const b = 2;

const r1 = a === b;
const r2 = a !== b;
const r3 = a === null;
const r4 = a !== undefined;
const r5 = (a === 1) ? 'yes' : 'no';

export { r1, r2, r3, r4, r5 };
