// eqeqeq — violations: uses == and !=

const a = 1;
const b = 2;

// Basic == violation
const r1 = a == b;

// Basic != violation
const r2 = a != b;

// == with null
const r3 = a == null;

// != with undefined
const r4 = a != undefined;

// Nested in expression
const r5 = (a == 1) ? 'yes' : 'no';

export { r1, r2, r3, r4, r5 };
