// This file is inside the domain directory.
// It has an import — violating noImports.

import { something } from './other';

export function handle() {
  return something();
}
