import { describe, it, expect } from 'vitest';
import { config } from '../src/lib/config';

describe('config', () => {
  it('has editor settings', () => {
    expect(config.editor.fontSize).toBeGreaterThan(0);
    expect(config.editor.tabSize).toBeGreaterThan(0);
  });

  it('has terminal settings', () => {
    expect(config.terminal.fontSize).toBeGreaterThan(0);
    expect(config.terminal.fontFamily).toContain('monospace');
    expect(config.terminal.initDelay).toBeGreaterThan(0);
  });

  it('has webcontainer settings', () => {
    expect(config.webcontainer.expectedBootMs).toBeGreaterThan(0);
    expect(config.webcontainer.expectedInstallMs).toBeGreaterThan(config.webcontainer.expectedBootMs);
    expect(config.webcontainer.bootTimeoutMs).toBeGreaterThan(config.webcontainer.expectedBootMs);
    expect(config.webcontainer.installTimeoutMs).toBeGreaterThan(config.webcontainer.expectedInstallMs);
    expect(config.webcontainer.progressCeiling).toBeLessThanOrEqual(100);
    expect(config.webcontainer.progressIntervalMs).toBeGreaterThan(0);
  });

  it('has storage settings', () => {
    expect(config.storage.version).toBe(1);
    expect(config.storage.prefix).toBe('ks:tutorial');
    expect(config.storage.autoSaveSlot).toBe('auto');
    expect(config.storage.autoSaveDelayMs).toBeGreaterThan(0);
  });

  it('has panel sizes for tutorial and sandbox', () => {
    const { tutorial, sandbox } = config.panels;

    // Tutorial panels
    expect(tutorial.content.default).toBeGreaterThan(0);
    expect(tutorial.content.min).toBeLessThan(tutorial.content.default);
    expect(tutorial.fileTree.default).toBeGreaterThan(0);
    expect(tutorial.editor.default).toBeGreaterThan(0);
    expect(tutorial.terminal.default).toBeGreaterThan(0);
    expect(tutorial.terminal.min).toBeLessThan(tutorial.terminal.default);

    // Sandbox panels
    expect(sandbox.info.default).toBeGreaterThan(0);
    expect(sandbox.fileTree.default).toBeGreaterThan(0);
    expect(sandbox.editor.default).toBeGreaterThan(0);
    expect(sandbox.terminal.default).toBeGreaterThan(0);

    // Totals should be roughly 100%
    const tutorialTotal = tutorial.content.default + tutorial.fileTree.default + tutorial.editor.default;
    expect(tutorialTotal).toBe(100);
  });

  it('has z-index layering in correct order', () => {
    expect(config.zIndex.menu).toBeLessThan(config.zIndex.dialog);
    expect(config.zIndex.dialog).toBeLessThan(config.zIndex.toast);
    expect(config.zIndex.toast).toBeLessThan(config.zIndex.overlay);
  });

  it('has export defaults', () => {
    expect(config.export.defaultProjectName).toBe('kindscript-project');
  });

  it('is frozen (as const)', () => {
    // Verify the type is readonly by checking a value doesn't change
    expect(() => {
      (config as any).editor.fontSize = 999;
    }).toThrow();
  });
});
