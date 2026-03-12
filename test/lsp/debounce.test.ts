/**
 * Tests for the debounce scheduler.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { AnalysisScheduler } from '../../apps/lsp/server/debounce.js';

describe('AnalysisScheduler', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls callback after delay', () => {
    vi.useFakeTimers();
    const scheduler = new AnalysisScheduler(100);
    const fn = vi.fn();

    scheduler.schedule(fn);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();

    scheduler.dispose();
  });

  it('cancels previous timer on re-schedule', () => {
    vi.useFakeTimers();
    const scheduler = new AnalysisScheduler(100);
    const fn1 = vi.fn();
    const fn2 = vi.fn();

    scheduler.schedule(fn1);
    vi.advanceTimersByTime(50);
    scheduler.schedule(fn2);

    vi.advanceTimersByTime(100);
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledOnce();

    scheduler.dispose();
  });

  it('cancel() prevents callback from firing', () => {
    vi.useFakeTimers();
    const scheduler = new AnalysisScheduler(100);
    const fn = vi.fn();

    scheduler.schedule(fn);
    scheduler.cancel();

    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();

    scheduler.dispose();
  });

  it('respects custom delay', () => {
    vi.useFakeTimers();
    const scheduler = new AnalysisScheduler(500);
    const fn = vi.fn();

    scheduler.schedule(fn, 200);

    vi.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledOnce();

    scheduler.dispose();
  });

  it('dispose cancels pending timer', () => {
    vi.useFakeTimers();
    const scheduler = new AnalysisScheduler(100);
    const fn = vi.fn();

    scheduler.schedule(fn);
    scheduler.dispose();

    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });
});
