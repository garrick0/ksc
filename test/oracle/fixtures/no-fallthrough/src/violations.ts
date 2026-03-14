// no-fallthrough: switch case fallthrough — violation cases

function test(x: number) {
  switch (x) {
    case 1:
      console.log("one");
    case 2:
      console.log("two");
      break;
    case 3:
      console.log("three");
    default:
      console.log("default");
  }
}

export { test };
