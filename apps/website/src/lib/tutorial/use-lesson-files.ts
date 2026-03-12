import { useState, useCallback } from 'react';
import { LessonFile } from '../lessons/types';

export interface LessonFilesState {
  currentFiles: LessonFile[];
  activeFile: string | null;
  openTabs: string[];
  splitFile: string | null;
}

export interface LessonFilesActions {
  setCurrentFiles: React.Dispatch<React.SetStateAction<LessonFile[]>>;
  handleFileSelect: (path: string) => void;
  handleTabClose: (path: string) => void;
  handleSplitToggle: () => void;
  handleSplitFileSelect: (path: string) => void;
  handleSplitTabClose: (path: string) => void;
  handleFileChange: (path: string, value: string, onWrite?: (path: string, value: string) => void) => void;
  resetFiles: (files: LessonFile[], focus: string | null) => void;
  currentFileContent: string;
  splitFileContent: string;
  leftTabs: string[];
  rightTabs: string[];
}

interface UseLessonFilesOptions {
  initialFiles: LessonFile[];
  initialFocus: string | null;
  onDirty?: () => void;
}

export function useLessonFiles({ initialFiles, initialFocus, onDirty }: UseLessonFilesOptions): LessonFilesState & LessonFilesActions {
  const [currentFiles, setCurrentFiles] = useState<LessonFile[]>(initialFiles);
  const [activeFile, setActiveFile] = useState<string | null>(initialFocus);
  const [openTabs, setOpenTabs] = useState<string[]>(initialFocus ? [initialFocus] : []);
  const [splitFile, setSplitFile] = useState<string | null>(null);

  const currentFileContent = activeFile ? currentFiles.find((f) => f.path === activeFile)?.contents || '' : '';
  const splitFileContent = splitFile ? currentFiles.find((f) => f.path === splitFile)?.contents || '' : '';

  const leftTabs = openTabs;
  const rightTabs = splitFile ? openTabs.filter((t) => t !== activeFile) : [];

  const handleFileSelect = useCallback((path: string) => {
    setActiveFile(path);
    setOpenTabs((tabs) => (tabs.includes(path) ? tabs : [...tabs, path]));
  }, []);

  const handleTabClose = useCallback((path: string) => {
    setOpenTabs((tabs) => {
      const newTabs = tabs.filter((t) => t !== path);
      if (newTabs.length === 0) {
        setActiveFile(null);
        return [];
      }
      setActiveFile((current) => {
        if (path === current) {
          const idx = tabs.indexOf(path);
          return newTabs[Math.min(idx, newTabs.length - 1)];
        }
        return current;
      });
      return newTabs;
    });
    setSplitFile((current) => (current === path ? null : current));
  }, []);

  const handleSplitToggle = useCallback(() => {
    if (splitFile) {
      setSplitFile(null);
    } else {
      const other = openTabs.find((t) => t !== activeFile) || currentFiles.find((f) => f.path !== activeFile)?.path;
      if (other) {
        setSplitFile(other);
        setOpenTabs((tabs) => (tabs.includes(other) ? tabs : [...tabs, other]));
      }
    }
  }, [splitFile, openTabs, activeFile, currentFiles]);

  const handleSplitFileSelect = useCallback((path: string) => {
    setSplitFile(path);
    setOpenTabs((tabs) => (tabs.includes(path) ? tabs : [...tabs, path]));
  }, []);

  const handleSplitTabClose = useCallback((path: string) => {
    if (path === splitFile) {
      const remaining = openTabs.filter((t) => t !== path && t !== activeFile);
      setSplitFile(remaining.length > 0 ? remaining[0] : null);
    }
    setOpenTabs((tabs) => {
      const newTabs = tabs.filter((t) => t !== path);
      if (newTabs.length === 0) {
        setActiveFile(null);
        return [];
      }
      setActiveFile((current) => {
        if (path === current) {
          const idx = tabs.indexOf(path);
          return newTabs[Math.min(idx, newTabs.length - 1)];
        }
        return current;
      });
      return newTabs;
    });
  }, [activeFile, splitFile, openTabs]);

  const handleFileChange = useCallback((path: string, value: string, onWrite?: (path: string, value: string) => void) => {
    setCurrentFiles((files) =>
      files.map((file) => (file.path === path ? { ...file, contents: value } : file))
    );
    onDirty?.();
    onWrite?.(path, value);
  }, [onDirty]);

  const resetFiles = useCallback((files: LessonFile[], focus: string | null) => {
    setCurrentFiles(files);
    setActiveFile(focus);
    setOpenTabs(focus ? [focus] : []);
    setSplitFile(null);
  }, []);

  return {
    currentFiles,
    activeFile,
    openTabs,
    splitFile,
    setCurrentFiles,
    handleFileSelect,
    handleTabClose,
    handleSplitToggle,
    handleSplitFileSelect,
    handleSplitTabClose,
    handleFileChange,
    resetFiles,
    currentFileContent,
    splitFileContent,
    leftTabs,
    rightTabs,
  };
}
