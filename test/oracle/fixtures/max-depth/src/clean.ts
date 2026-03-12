// max-depth (max: 4): nesting within limit

function withinLimit(x: boolean) {
  if (x) {
    if (x) {
      if (x) {
        if (x) {
          // depth 4 — exactly at limit, OK
          const a = 1;
        }
      }
    }
  }
}
