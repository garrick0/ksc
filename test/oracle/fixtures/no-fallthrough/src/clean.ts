// no-fallthrough: no fallthrough — clean cases

function test(x: number) {
  switch (x) {
    case 1:
      console.log("one");
      break;
    case 2:
      console.log("two");
      break;
    case 3:
    case 4:
      console.log("three or four");
      break;
    default:
      console.log("default");
  }
}

export { test };
