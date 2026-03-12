// default-case-last: violations — default not last
const x = 1;
switch (x) {
  default: break;
  case 1: break;
  case 2: break;
}
