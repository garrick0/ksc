import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLessonFiles } from '../src/lib/tutorial/use-lesson-files';
import type { LessonFile } from '../src/lib/lessons/types';

const FILES: LessonFile[] = [
  { path: 'src/index.ts', contents: 'index' },
  { path: 'src/util.ts', contents: 'util' },
  { path: 'src/types.ts', contents: 'types' },
];

describe('useLessonFiles', () => {
  it('initializes with provided files and focus', () => {
    const { result } = renderHook(() =>
      useLessonFiles({ initialFiles: FILES, initialFocus: 'src/index.ts' })
    );

    expect(result.current.currentFiles).toBe(FILES);
    expect(result.current.activeFile).toBe('src/index.ts');
    expect(result.current.openTabs).toEqual(['src/index.ts']);
    expect(result.current.splitFile).toBeNull();
    expect(result.current.currentFileContent).toBe('index');
  });

  it('initializes with null focus', () => {
    const { result } = renderHook(() =>
      useLessonFiles({ initialFiles: [], initialFocus: null })
    );

    expect(result.current.activeFile).toBeNull();
    expect(result.current.openTabs).toEqual([]);
    expect(result.current.currentFileContent).toBe('');
  });

  describe('handleFileSelect', () => {
    it('sets active file and adds to tabs', () => {
      const { result } = renderHook(() =>
        useLessonFiles({ initialFiles: FILES, initialFocus: 'src/index.ts' })
      );

      act(() => result.current.handleFileSelect('src/util.ts'));

      expect(result.current.activeFile).toBe('src/util.ts');
      expect(result.current.openTabs).toEqual(['src/index.ts', 'src/util.ts']);
    });

    it('does not duplicate tab', () => {
      const { result } = renderHook(() =>
        useLessonFiles({ initialFiles: FILES, initialFocus: 'src/index.ts' })
      );

      act(() => result.current.handleFileSelect('src/util.ts'));
      act(() => result.current.handleFileSelect('src/util.ts'));

      expect(result.current.openTabs).toEqual(['src/index.ts', 'src/util.ts']);
    });
  });

  describe('handleTabClose', () => {
    it('closes tab and selects adjacent', () => {
      const { result } = renderHook(() =>
        useLessonFiles({ initialFiles: FILES, initialFocus: 'src/index.ts' })
      );

      act(() => result.current.handleFileSelect('src/util.ts'));
      act(() => result.current.handleFileSelect('src/types.ts'));
      // Tabs: [index, util, types], active: types

      act(() => result.current.handleTabClose('src/types.ts'));

      expect(result.current.openTabs).toEqual(['src/index.ts', 'src/util.ts']);
      // Should select the previous adjacent tab
      expect(result.current.activeFile).toBe('src/util.ts');
    });

    it('clears split if split file is closed', () => {
      const { result } = renderHook(() =>
        useLessonFiles({ initialFiles: FILES, initialFocus: 'src/index.ts' })
      );

      act(() => result.current.handleFileSelect('src/util.ts'));
      act(() => result.current.handleSplitToggle());
      // splitFile should be set to something

      const splitPath = result.current.splitFile;
      expect(splitPath).not.toBeNull();

      act(() => result.current.handleTabClose(splitPath!));
      expect(result.current.splitFile).toBeNull();
    });
  });

  describe('handleSplitToggle', () => {
    it('opens split with another open tab', () => {
      const { result } = renderHook(() =>
        useLessonFiles({ initialFiles: FILES, initialFocus: 'src/index.ts' })
      );

      act(() => result.current.handleFileSelect('src/util.ts'));
      act(() => result.current.handleSplitToggle());

      expect(result.current.splitFile).not.toBeNull();
      expect(result.current.splitFile).not.toBe(result.current.activeFile);
    });

    it('closes split on second toggle', () => {
      const { result } = renderHook(() =>
        useLessonFiles({ initialFiles: FILES, initialFocus: 'src/index.ts' })
      );

      act(() => result.current.handleFileSelect('src/util.ts'));
      act(() => result.current.handleSplitToggle());
      expect(result.current.splitFile).not.toBeNull();

      act(() => result.current.handleSplitToggle());
      expect(result.current.splitFile).toBeNull();
    });
  });

  describe('handleFileChange', () => {
    it('updates file content and calls onDirty', () => {
      const onDirty = vi.fn();
      const { result } = renderHook(() =>
        useLessonFiles({ initialFiles: FILES, initialFocus: 'src/index.ts', onDirty })
      );

      act(() => result.current.handleFileChange('src/index.ts', 'new content'));

      expect(result.current.currentFileContent).toBe('new content');
      expect(onDirty).toHaveBeenCalledTimes(1);
    });

    it('calls onWrite callback', () => {
      const onWrite = vi.fn();
      const { result } = renderHook(() =>
        useLessonFiles({ initialFiles: FILES, initialFocus: 'src/index.ts' })
      );

      act(() => result.current.handleFileChange('src/index.ts', 'updated', onWrite));

      expect(onWrite).toHaveBeenCalledWith('src/index.ts', 'updated');
    });
  });

  describe('resetFiles', () => {
    it('resets all state', () => {
      const { result } = renderHook(() =>
        useLessonFiles({ initialFiles: FILES, initialFocus: 'src/index.ts' })
      );

      act(() => result.current.handleFileSelect('src/util.ts'));
      act(() => result.current.handleSplitToggle());

      const newFiles: LessonFile[] = [{ path: 'a.ts', contents: 'a' }];
      act(() => result.current.resetFiles(newFiles, 'a.ts'));

      expect(result.current.currentFiles).toEqual(newFiles);
      expect(result.current.activeFile).toBe('a.ts');
      expect(result.current.openTabs).toEqual(['a.ts']);
      expect(result.current.splitFile).toBeNull();
    });
  });

  describe('computed properties', () => {
    it('leftTabs equals openTabs', () => {
      const { result } = renderHook(() =>
        useLessonFiles({ initialFiles: FILES, initialFocus: 'src/index.ts' })
      );

      act(() => result.current.handleFileSelect('src/util.ts'));
      expect(result.current.leftTabs).toEqual(result.current.openTabs);
    });

    it('rightTabs excludes active file when split', () => {
      const { result } = renderHook(() =>
        useLessonFiles({ initialFiles: FILES, initialFocus: 'src/index.ts' })
      );

      act(() => result.current.handleFileSelect('src/util.ts'));
      act(() => result.current.handleSplitToggle());

      expect(result.current.rightTabs).not.toContain(result.current.activeFile);
    });

    it('rightTabs is empty when not split', () => {
      const { result } = renderHook(() =>
        useLessonFiles({ initialFiles: FILES, initialFocus: 'src/index.ts' })
      );

      expect(result.current.rightTabs).toEqual([]);
    });

    it('splitFileContent returns content of split file', () => {
      const { result } = renderHook(() =>
        useLessonFiles({ initialFiles: FILES, initialFocus: 'src/index.ts' })
      );

      act(() => result.current.handleFileSelect('src/util.ts'));
      act(() => result.current.handleSplitToggle());

      const splitPath = result.current.splitFile;
      const expectedContent = FILES.find((f) => f.path === splitPath)?.contents || '';
      expect(result.current.splitFileContent).toBe(expectedContent);
    });
  });
});
