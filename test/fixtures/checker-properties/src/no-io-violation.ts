import type { NoIO } from './kinds';
import { readFileSync } from 'fs';

export const loader: NoIO & ((p: string) => string) = (p) => readFileSync(p, 'utf-8');
