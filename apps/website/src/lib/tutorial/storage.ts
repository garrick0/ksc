import { LessonFile } from '../lessons/types';
import { config } from '../config';

const STORAGE_VERSION = config.storage.version;
const PREFIX = config.storage.prefix;
const AUTO_SAVE_SLOT = config.storage.autoSaveSlot;

export interface SavedLesson {
  version: number;
  lessonSlug: string;
  slotName: string | null;
  files: LessonFile[];
  activeFile: string;
  timestamp: number;
  label?: string;
}

function getKey(slug: string, slot: string): string {
  return `${PREFIX}:${slug}:${slot}`;
}

function safeParseJSON<T>(json: string | null): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function isValidSave(data: unknown): data is SavedLesson {
  if (!data || typeof data !== 'object') return false;
  const save = data as Record<string, unknown>;
  return (
    typeof save.version === 'number' &&
    typeof save.lessonSlug === 'string' &&
    (save.slotName === null || typeof save.slotName === 'string') &&
    Array.isArray(save.files) &&
    typeof save.activeFile === 'string' &&
    typeof save.timestamp === 'number'
  );
}

// Auto-save functions
export function autoSave(slug: string, files: LessonFile[], activeFile: string): void {
  if (typeof window === 'undefined') return;

  const save: SavedLesson = {
    version: STORAGE_VERSION,
    lessonSlug: slug,
    slotName: null,
    files,
    activeFile,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(getKey(slug, AUTO_SAVE_SLOT), JSON.stringify(save));
  } catch (error) {
    console.warn('Failed to auto-save:', error);
  }
}

export function loadAutoSave(slug: string): SavedLesson | null {
  if (typeof window === 'undefined') return null;

  const data = safeParseJSON<SavedLesson>(localStorage.getItem(getKey(slug, AUTO_SAVE_SLOT)));
  return data && isValidSave(data) ? data : null;
}

export function hasAutoSave(slug: string): boolean {
  return loadAutoSave(slug) !== null;
}

export function clearAutoSave(slug: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(getKey(slug, AUTO_SAVE_SLOT));
}

// Named save functions
export function namedSave(
  slug: string,
  name: string,
  files: LessonFile[],
  activeFile: string,
  label?: string
): void {
  if (typeof window === 'undefined') return;
  if (!name.trim()) throw new Error('Save name cannot be empty');

  const save: SavedLesson = {
    version: STORAGE_VERSION,
    lessonSlug: slug,
    slotName: name,
    files,
    activeFile,
    timestamp: Date.now(),
    label: label || name,
  };

  try {
    localStorage.setItem(getKey(slug, `save:${name}`), JSON.stringify(save));
  } catch (error) {
    console.error('Failed to save:', error);
    throw new Error('Failed to save: storage quota exceeded');
  }
}

export function loadNamedSave(slug: string, name: string): SavedLesson | null {
  if (typeof window === 'undefined') return null;

  const data = safeParseJSON<SavedLesson>(localStorage.getItem(getKey(slug, `save:${name}`)));
  return data && isValidSave(data) ? data : null;
}

export function listNamedSaves(slug: string): SavedLesson[] {
  if (typeof window === 'undefined') return [];

  const prefix = `${PREFIX}:${slug}:save:`;
  const saves: SavedLesson[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      const data = safeParseJSON<SavedLesson>(localStorage.getItem(key));
      if (data && isValidSave(data)) {
        saves.push(data);
      }
    }
  }

  // Sort by timestamp, newest first
  return saves.sort((a, b) => b.timestamp - a.timestamp);
}

export function deleteNamedSave(slug: string, name: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(getKey(slug, `save:${name}`));
}

// Utility functions
export function clearAllSaves(): void {
  if (typeof window === 'undefined') return;

  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) {
      keys.push(key);
    }
  }

  keys.forEach((key) => localStorage.removeItem(key));
}

export function getTotalSaveSize(): number {
  if (typeof window === 'undefined') return 0;

  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) {
      const value = localStorage.getItem(key);
      if (value) {
        total += key.length + value.length;
      }
    }
  }
  return total;
}
