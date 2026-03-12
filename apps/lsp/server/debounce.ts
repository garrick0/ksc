/**
 * Analysis scheduler — debounced re-analysis after file changes.
 *
 * Cancels any pending timer on each new schedule() call, ensuring
 * the callback only fires after a quiet period (no changes for delayMs).
 */

export class AnalysisScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private defaultDelay: number;

  constructor(delayMs = 500) {
    this.defaultDelay = delayMs;
  }

  /** Schedule a callback after the debounce delay. Cancels any pending timer. */
  schedule(callback: () => void, delayMs?: number): void {
    this.cancel();
    this.timer = setTimeout(() => {
      this.timer = null;
      callback();
    }, delayMs ?? this.defaultDelay);
  }

  /** Cancel any pending timer without firing the callback. */
  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Cancel and release resources. */
  dispose(): void {
    this.cancel();
  }
}
