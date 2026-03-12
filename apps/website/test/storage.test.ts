import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage before importing storage module
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
};

vi.stubGlobal('window', { ...globalThis, localStorage: localStorageMock });
vi.stubGlobal('localStorage', localStorageMock);

import {
  autoSave,
  loadAutoSave,
  hasAutoSave,
  clearAutoSave,
  namedSave,
  loadNamedSave,
  listNamedSaves,
  deleteNamedSave,
  clearAllSaves,
  getTotalSaveSize,
} from '../src/lib/tutorial/storage';
import type { LessonFile } from '../src/lib/lessons/types';

const FILES: LessonFile[] = [
  { path: 'src/index.ts', contents: 'console.log("hello")' },
  { path: 'src/util.ts', contents: 'export const x = 1;' },
];

describe('storage', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('autoSave / loadAutoSave / hasAutoSave / clearAutoSave', () => {
    it('round-trips auto-save data', () => {
      expect(hasAutoSave('lesson-1')).toBe(false);
      expect(loadAutoSave('lesson-1')).toBeNull();

      autoSave('lesson-1', FILES, 'src/index.ts');

      expect(hasAutoSave('lesson-1')).toBe(true);
      const loaded = loadAutoSave('lesson-1');
      expect(loaded).not.toBeNull();
      expect(loaded!.files).toEqual(FILES);
      expect(loaded!.activeFile).toBe('src/index.ts');
      expect(loaded!.lessonSlug).toBe('lesson-1');
      expect(loaded!.slotName).toBeNull();
      expect(typeof loaded!.timestamp).toBe('number');
    });

    it('clearAutoSave removes auto-save', () => {
      autoSave('lesson-1', FILES, 'src/index.ts');
      expect(hasAutoSave('lesson-1')).toBe(true);

      clearAutoSave('lesson-1');
      expect(hasAutoSave('lesson-1')).toBe(false);
      expect(loadAutoSave('lesson-1')).toBeNull();
    });

    it('returns null for corrupted data', () => {
      localStorage.setItem('ks:tutorial:lesson-1:auto', '{{invalid json');
      expect(loadAutoSave('lesson-1')).toBeNull();
    });

    it('returns null for data missing required fields', () => {
      localStorage.setItem('ks:tutorial:lesson-1:auto', JSON.stringify({ version: 1 }));
      expect(loadAutoSave('lesson-1')).toBeNull();
    });
  });

  describe('namedSave / loadNamedSave / listNamedSaves / deleteNamedSave', () => {
    it('round-trips named save data', () => {
      namedSave('lesson-1', 'my-save', FILES, 'src/index.ts', 'My Save');

      const loaded = loadNamedSave('lesson-1', 'my-save');
      expect(loaded).not.toBeNull();
      expect(loaded!.files).toEqual(FILES);
      expect(loaded!.slotName).toBe('my-save');
      expect(loaded!.label).toBe('My Save');
    });

    it('throws on empty name', () => {
      expect(() => namedSave('lesson-1', '  ', FILES, 'src/index.ts')).toThrow('Save name cannot be empty');
    });

    it('lists named saves sorted newest first', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      namedSave('lesson-1', 'first', FILES, 'src/index.ts');

      vi.setSystemTime(new Date('2026-01-01T00:01:00Z'));
      namedSave('lesson-1', 'second', FILES, 'src/util.ts');
      vi.useRealTimers();

      const list = listNamedSaves('lesson-1');
      expect(list).toHaveLength(2);
      // newest first
      expect(list[0].slotName).toBe('second');
      expect(list[1].slotName).toBe('first');
    });

    it('deleteNamedSave removes only the target', () => {
      namedSave('lesson-1', 'keep', FILES, 'src/index.ts');
      namedSave('lesson-1', 'delete-me', FILES, 'src/index.ts');

      deleteNamedSave('lesson-1', 'delete-me');

      expect(loadNamedSave('lesson-1', 'delete-me')).toBeNull();
      expect(loadNamedSave('lesson-1', 'keep')).not.toBeNull();
    });

    it('returns empty list for unknown slug', () => {
      expect(listNamedSaves('nonexistent')).toEqual([]);
    });

    it('returns null for unknown save name', () => {
      expect(loadNamedSave('lesson-1', 'nope')).toBeNull();
    });
  });

  describe('clearAllSaves / getTotalSaveSize', () => {
    it('clearAllSaves removes all tutorial saves', () => {
      autoSave('a', FILES, 'src/index.ts');
      namedSave('b', 'x', FILES, 'src/index.ts');
      // non-tutorial key should survive
      localStorage.setItem('other-key', 'should-stay');

      clearAllSaves();

      expect(hasAutoSave('a')).toBe(false);
      expect(loadNamedSave('b', 'x')).toBeNull();
      expect(localStorage.getItem('other-key')).toBe('should-stay');
    });

    it('getTotalSaveSize returns byte count for tutorial keys', () => {
      expect(getTotalSaveSize()).toBe(0);

      autoSave('lesson-1', FILES, 'src/index.ts');
      expect(getTotalSaveSize()).toBeGreaterThan(0);
    });
  });

  describe('isolation between slugs', () => {
    it('saves for different slugs are independent', () => {
      autoSave('lesson-1', FILES, 'src/index.ts');
      autoSave('lesson-2', [{ path: 'a.ts', contents: 'a' }], 'a.ts');

      const l1 = loadAutoSave('lesson-1')!;
      const l2 = loadAutoSave('lesson-2')!;

      expect(l1.files).toEqual(FILES);
      expect(l2.files).toEqual([{ path: 'a.ts', contents: 'a' }]);
    });
  });
});
