/**
 * Website configuration — single source of truth for functional constants.
 *
 * Covers timeouts, panel sizes, storage keys, editor/terminal settings,
 * and z-index layering. Visual styles (colors, fonts, padding) remain
 * co-located with their components.
 */

export const config = {
  editor: {
    fontSize: 14,
    tabSize: 2,
  },
  terminal: {
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    initDelay: 100,
  },
  webcontainer: {
    expectedBootMs: 3000,
    expectedInstallMs: 45000,
    bootTimeoutMs: 30000,
    installTimeoutMs: 120000,
    progressCeiling: 90,
    progressIntervalMs: 100,
  },
  storage: {
    version: 1,
    prefix: 'ks:tutorial',
    autoSaveSlot: 'auto',
    autoSaveDelayMs: 2000,
  },
  panels: {
    tutorial: {
      content: { default: 30, min: 15 },
      fileTree: { default: 12, min: 8, max: 25 },
      editor: { default: 58 },
      editorArea: { default: 60 },
      terminal: { default: 40, min: 10 },
    },
    sandbox: {
      info: { default: 30, min: 15 },
      fileTree: { default: 15, min: 10, max: 30 },
      editor: { default: 55 },
      editorArea: { default: 60 },
      terminal: { default: 40, min: 10 },
    },
  },
  zIndex: {
    menu: 1000,
    dialog: 2000,
    toast: 3000,
    overlay: 9999,
  },
  export: {
    defaultProjectName: 'kindscript-project',
  },
} as const;

function deepFreeze<T extends object>(obj: T): T {
  Object.freeze(obj);
  for (const val of Object.values(obj)) {
    if (val && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val as object);
    }
  }
  return obj;
}

deepFreeze(config);
