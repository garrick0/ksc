// This file is inside the infra directory.
// It imports an IO module — violating noIO.

import { readFileSync } from 'fs';

export function loadConfig(path: string) {
  return readFileSync(path, 'utf-8');
}
