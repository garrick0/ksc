// max-depth (max: 4): nesting that exceeds depth 4

function deeplyNested(x: boolean) {
  if (x) {
    if (x) {
      if (x) {
        if (x) {
          if (x) {
            // depth 5 — violation on this if
            const a = 1;
          }
        }
      }
    }
  }
}
