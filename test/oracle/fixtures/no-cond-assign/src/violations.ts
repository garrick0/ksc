// no-cond-assign: violations — assignment in conditions
let x: any;
if (x = 1) { /* empty */ x; }
while (x = getNext()) { x; }
function getNext(): any { return null; }
