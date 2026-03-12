import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutoSave } from '../src/lib/tutorial/use-auto-save';
import * as storage from '../src/lib/tutorial/storage';

vi.mock('../src/lib/tutorial/storage', () => ({
  autoSave: vi.fn(),
}));

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not save when not dirty', () => {
    renderHook(() =>
      useAutoSave({
        slug: 'test',
        files: [{ path: 'a.ts', contents: 'a' }],
        activeFile: 'a.ts',
        isDirty: false,
      })
    );

    vi.advanceTimersByTime(5000);
    expect(storage.autoSave).not.toHaveBeenCalled();
  });

  it('does not save when files are empty', () => {
    renderHook(() =>
      useAutoSave({
        slug: 'test',
        files: [],
        activeFile: null,
        isDirty: true,
      })
    );

    vi.advanceTimersByTime(5000);
    expect(storage.autoSave).not.toHaveBeenCalled();
  });

  it('saves after debounce delay when dirty', () => {
    const files = [{ path: 'a.ts', contents: 'a' }];

    renderHook(() =>
      useAutoSave({
        slug: 'test',
        files,
        activeFile: 'a.ts',
        isDirty: true,
      })
    );

    // Not saved yet (debounce)
    vi.advanceTimersByTime(1000);
    expect(storage.autoSave).not.toHaveBeenCalled();

    // Saved after full delay (2000ms default)
    vi.advanceTimersByTime(1500);
    expect(storage.autoSave).toHaveBeenCalledWith('test', files, 'a.ts');
  });

  it('uses first file path when activeFile is null', () => {
    const files = [{ path: 'b.ts', contents: 'b' }];

    renderHook(() =>
      useAutoSave({
        slug: 'test',
        files,
        activeFile: null,
        isDirty: true,
      })
    );

    vi.advanceTimersByTime(3000);
    expect(storage.autoSave).toHaveBeenCalledWith('test', files, 'b.ts');
  });

  it('debounces rapid changes', () => {
    const files1 = [{ path: 'a.ts', contents: 'v1' }];
    const files2 = [{ path: 'a.ts', contents: 'v2' }];

    const { rerender } = renderHook(
      ({ files }) =>
        useAutoSave({ slug: 'test', files, activeFile: 'a.ts', isDirty: true }),
      { initialProps: { files: files1 } }
    );

    vi.advanceTimersByTime(1000);
    rerender({ files: files2 });

    // Wait for full debounce from last change
    vi.advanceTimersByTime(3000);

    // Should only have saved the latest version
    const calls = (storage.autoSave as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(1);
    expect(calls[0][1]).toBe(files2);
  });

  it('registers beforeunload handler when dirty', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');

    renderHook(() =>
      useAutoSave({
        slug: 'test',
        files: [{ path: 'a.ts', contents: 'a' }],
        activeFile: 'a.ts',
        isDirty: true,
      })
    );

    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    addSpy.mockRestore();
  });
});
