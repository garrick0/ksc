import type { Static } from './kinds';

export const dynamicLoader: Static & ((mod: string) => Promise<any>) = async (mod) => {
  return import(mod);
};
