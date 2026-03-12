// no-bitwise — violations: uses bitwise operators

const a = 1;
const b = 2;

const r1 = a | b;
const r2 = a & b;
const r3 = a ^ b;
const r4 = ~a;
const r5 = a << 1;
const r6 = a >> 1;
const r7 = a >>> 1;

export { r1, r2, r3, r4, r5, r6, r7 };
