// no-duplicate-case: violations
const x = 1;
switch (x) {
  case 1: break;
  case 2: break;
  case 1: break;
  default: break;
}
