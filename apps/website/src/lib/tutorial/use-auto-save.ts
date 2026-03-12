import { useEffect, useRef } from 'react';
import { LessonFile } from '../lessons/types';
import { config } from '../config';
import * as storage from './storage';

interface UseAutoSaveOptions {
  slug: string;
  files: LessonFile[];
  activeFile: string | null;
  isDirty: boolean;
}

/**
 * Debounced auto-save to localStorage, plus save-on-beforeunload.
 */
export function useAutoSave({ slug, files, activeFile, isDirty }: UseAutoSaveOptions): void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced auto-save
  useEffect(() => {
    if (!isDirty || files.length === 0) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const fileToSave = activeFile || files[0].path;
      storage.autoSave(slug, files, fileToSave);
    }, config.storage.autoSaveDelayMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [files, activeFile, isDirty, slug]);

  // Save on beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isDirty && files.length > 0) {
        const fileToSave = activeFile || files[0].path;
        storage.autoSave(slug, files, fileToSave);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, files, activeFile, slug]);
}
