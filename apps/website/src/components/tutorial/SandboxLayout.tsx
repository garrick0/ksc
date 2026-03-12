'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels';
import { LessonFile } from '@/lib/lessons/types';
import { EditableFileTree } from './EditableFileTree';
import { EditorTabs } from './EditorTabs';
import { LoadingOverlay } from './LoadingOverlay';
import { SaveMenu } from './SaveMenu';
import { SaveDialog } from './SaveDialog';
import { LoadDialog } from './LoadDialog';
import { ResumeBanner } from './ResumeBanner';
import { useToast } from './Toast';
import type { WebContainerHandle } from './WebContainerProvider';
import * as storage from '@/lib/tutorial/storage';
import { downloadAsZip, copyFileToClipboard } from '@/lib/tutorial/export';
import { SANDBOX_TEMPLATES, SandboxTemplate } from '@/lib/tutorial/sandbox-templates';
import { config } from '@/lib/config';
import { useLessonFiles } from '@/lib/tutorial/use-lesson-files';
import { useAutoSave } from '@/lib/tutorial/use-auto-save';

const CodeEditor = dynamic(() => import('./CodeEditor').then((mod) => mod.CodeEditor), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#ccc' }}>
      Loading editor...
    </div>
  ),
});

const Terminal = dynamic(() => import('./Terminal').then((mod) => ({ default: mod.Terminal })), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#ccc' }}>
      Loading terminal...
    </div>
  ),
});

const WebContainerProvider = dynamic(() => import('./WebContainerProvider').then((mod) => mod.WebContainerProvider), {
  ssr: false,
});

const SANDBOX_SLUG = 'sandbox';

export function SandboxLayout() {
  const [containerState, setContainerState] = useState<'idle' | 'booting' | 'installing' | 'ready' | 'error'>('idle');
  const [terminal, setTerminal] = useState<any>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const webcontainerRef = useRef<WebContainerHandle>(null);
  const infoPanelRef = useRef<ImperativePanelHandle>(null);
  const terminalPanelRef = useRef<ImperativePanelHandle>(null);
  const { showToast, ToastContainer } = useToast();

  const fileState = useLessonFiles({
    initialFiles: [],
    initialFocus: null,
    onDirty: () => setIsDirty(true),
  });

  const {
    currentFiles, activeFile, openTabs, splitFile,
    handleFileSelect, handleTabClose, handleSplitToggle,
    handleSplitFileSelect, handleSplitTabClose, handleFileChange,
    resetFiles, setCurrentFiles,
    currentFileContent, splitFileContent, leftTabs, rightTabs,
  } = fileState;

  useAutoSave({ slug: SANDBOX_SLUG, files: currentFiles, activeFile, isDirty });

  const handleTerminalReady = (term: any) => {
    setTerminal(term);
  };

  // Check for auto-save on mount
  useEffect(() => {
    const autoSave = storage.loadAutoSave(SANDBOX_SLUG);
    if (autoSave) {
      setShowResumeBanner(true);
    } else {
      loadTemplate(SANDBOX_TEMPLATES[0]);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        setShowSaveDialog(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (activeFile) handleTabClose(activeFile);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, openTabs, handleTabClose]);

  const loadTemplate = (template: SandboxTemplate) => {
    const firstFile = template.files[0]?.path || null;
    resetFiles(template.files, firstFile);
    setIsDirty(false);
    showToast(`Loaded ${template.name} template`, 'info');
  };

  const handleReset = () => {
    setShowTemplateDialog(true);
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined || !activeFile) return;
    handleFileChange(activeFile, value, (p, v) => webcontainerRef.current?.writeFile(p, v));
  };

  const handleSplitEditorChange = (value: string | undefined) => {
    if (value === undefined || !splitFile) return;
    handleFileChange(splitFile, value, (p, v) => webcontainerRef.current?.writeFile(p, v));
  };

  const handleCreateFile = useCallback((path: string) => {
    if (path.endsWith('/.gitkeep')) {
      setCurrentFiles((files) => [...files, { path, contents: '' }]);
      setIsDirty(true);
      return;
    }

    const contents = `// ${path}\n`;
    setCurrentFiles((files) => [...files, { path, contents }]);
    handleFileSelect(path);
    setIsDirty(true);
    webcontainerRef.current?.writeFile(path, contents);
    showToast(`Created ${path}`, 'success');
  }, [showToast, handleFileSelect, setCurrentFiles]);

  const handleDeleteFile = useCallback((path: string) => {
    setCurrentFiles((files) => files.filter((f) => !f.path.startsWith(path)));
    // The file state will be cleaned up by the file select/close handlers if needed
    setIsDirty(true);
    showToast(`Deleted ${path}`, 'info');
  }, [showToast, setCurrentFiles]);

  const handleRenameFile = useCallback((oldPath: string, newPath: string) => {
    setCurrentFiles((files) =>
      files.map((file) => {
        if (file.path === oldPath || file.path.startsWith(oldPath + '/')) {
          return { ...file, path: file.path.replace(oldPath, newPath) };
        }
        return file;
      })
    );
    setIsDirty(true);
    showToast(`Renamed to ${newPath}`, 'success');
  }, [showToast, setCurrentFiles]);

  const handleSave = useCallback((name: string) => {
    try {
      const fileToSave = activeFile || currentFiles[0]?.path || '';
      storage.namedSave(SANDBOX_SLUG, name, currentFiles, fileToSave);
      showToast(`Saved as "${name}"`, 'success');
    } catch (error) {
      showToast('Failed to save: storage quota exceeded', 'error');
    }
  }, [currentFiles, activeFile, showToast]);

  const handleLoad = useCallback((save: storage.SavedLesson) => {
    resetFiles(save.files, save.activeFile);
    setIsDirty(false);
    const label = save.slotName === null ? 'Auto-save' : save.label || save.slotName;
    showToast(`Loaded "${label}"`, 'success');
  }, [showToast, resetFiles]);

  const handleDelete = useCallback((save: storage.SavedLesson) => {
    if (save.slotName === null) {
      storage.clearAutoSave(SANDBOX_SLUG);
    } else {
      storage.deleteNamedSave(SANDBOX_SLUG, save.slotName);
    }
    showToast('Save deleted', 'info');
  }, [showToast]);

  const handleExport = useCallback(async () => {
    try {
      await downloadAsZip(currentFiles, 'kindscript-sandbox');
      showToast('Downloaded ZIP file', 'success');
    } catch (error) {
      showToast('Failed to download ZIP', 'error');
    }
  }, [currentFiles, showToast]);

  const handleRestoreAutoSave = () => {
    const autoSave = storage.loadAutoSave(SANDBOX_SLUG);
    if (autoSave) {
      handleLoad(autoSave);
      setShowResumeBanner(false);
    }
  };

  const handleDismissResumeBanner = () => {
    setShowResumeBanner(false);
    storage.clearAutoSave(SANDBOX_SLUG);
    loadTemplate(SANDBOX_TEMPLATES[0]);
  };

  const handleCopyFile = useCallback(async () => {
    const success = await copyFileToClipboard(currentFileContent);
    if (success) {
      showToast('Copied to clipboard', 'success');
    } else {
      showToast('Failed to copy', 'error');
    }
  }, [currentFileContent, showToast]);

  const handleRunCheck = () => {
    webcontainerRef.current?.runCommand('npm', ['run', 'check']);
  };

  const getLanguage = (path: string) => {
    if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
    if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.md')) return 'markdown';
    return 'plaintext';
  };

  const isReady = containerState === 'ready';
  const namedSaves = storage.listNamedSaves(SANDBOX_SLUG);
  const autoSave = storage.loadAutoSave(SANDBOX_SLUG);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Resume banner */}
      {showResumeBanner && (
        <ResumeBanner onRestore={handleRestoreAutoSave} onDismiss={handleDismissResumeBanner} />
      )}

      {/* Top nav bar */}
      <div
        style={{
          background: '#1e293b',
          color: 'white',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <a
            href="/tutorial"
            style={{ color: 'white', textDecoration: 'none', fontSize: '1.125rem', fontWeight: 600 }}
          >
            ← Back to Lessons
          </a>
          <div style={{ color: '#94a3b8' }}>|</div>
          <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Sandbox Mode</div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {containerState === 'booting' && (
            <span style={{ fontSize: '0.875rem', color: '#fbbf24' }}>⏳ Booting...</span>
          )}
          {containerState === 'installing' && (
            <span style={{ fontSize: '0.875rem', color: '#fbbf24' }}>📦 Installing...</span>
          )}
          {containerState === 'ready' && (
            <span style={{ fontSize: '0.875rem', color: '#10b981' }}>✓ Ready</span>
          )}
          {containerState === 'error' && (
            <span style={{ fontSize: '0.875rem', color: '#ef4444' }}>✗ Error</span>
          )}

          <button
            onClick={handleRunCheck}
            disabled={!isReady}
            style={{
              background: isReady ? '#10b981' : '#64748b',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: isReady ? 'pointer' : 'not-allowed',
              fontSize: '0.875rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            ▶ Run Check
          </button>

          <button
            onClick={() => setShowTemplateDialog(true)}
            style={{
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            📑 Templates
          </button>

          <SaveMenu
            onSave={() => setShowSaveDialog(true)}
            onLoad={() => setShowLoadDialog(true)}
            onExport={handleExport}
            onReset={handleReset}
            disabled={!isReady}
          />
        </div>
      </div>

      {/* Main content area */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <PanelGroup direction="horizontal">
          {/* Left panel: Project info */}
          <Panel
            ref={infoPanelRef}
            defaultSize={config.panels.sandbox.info.default}
            minSize={config.panels.sandbox.info.min}
            maxSize={50}
            collapsible
            collapsedSize={0}
          >
            <div
              style={{
                height: '100%',
                borderRight: '1px solid #e5e7eb',
                overflow: 'auto',
                background: 'white',
                padding: '1.5rem',
              }}
            >
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>
                🧪 Sandbox Mode
              </h1>
              <p style={{ color: '#64748b', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                Experiment with KindScript beyond tutorial constraints. Create, modify, and delete files to prototype
                architectural patterns.
              </p>

              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: '#1e293b' }}>
                  Quick Start
                </h2>
                <ul style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: '1.6', paddingLeft: '1.25rem' }}>
                  <li>Right-click files/folders for context menu</li>
                  <li>Use 📄+ / 📁+ buttons to create files/folders</li>
                  <li>Click "Run Check" to validate architecture</li>
                  <li>Save your work with Ctrl+S</li>
                  <li>Export as ZIP to use in your projects</li>
                </ul>
              </div>

              <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
                <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: '#1e40af' }}>
                  💡 Try These Templates
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                  {SANDBOX_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => {
                        loadTemplate(template);
                        setShowTemplateDialog(false);
                      }}
                      style={{
                        background: 'white',
                        border: '1px solid #dbeafe',
                        borderRadius: '6px',
                        padding: '0.75rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '0.875rem',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: '#1e40af', marginBottom: '0.25rem' }}>{template.name}</div>
                      <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{template.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          <PanelResizeHandle
            style={{
              width: '4px',
              background: '#e5e7eb',
              cursor: 'col-resize',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#3b82f6'; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.background = '#e5e7eb'; }}
          />

          {/* File tree */}
          <Panel defaultSize={config.panels.sandbox.fileTree.default} minSize={config.panels.sandbox.fileTree.min} maxSize={config.panels.sandbox.fileTree.max} collapsible collapsedSize={0}>
            <div style={{ height: '100%', borderRight: '1px solid #3e3e42' }}>
              <EditableFileTree
                files={currentFiles}
                activeFile={activeFile}
                onFileSelect={handleFileSelect}
                onCreateFile={handleCreateFile}
                onDeleteFile={handleDeleteFile}
                onRenameFile={handleRenameFile}
              />
            </div>
          </Panel>

          <PanelResizeHandle
            style={{
              width: '4px',
              background: '#3e3e42',
              cursor: 'col-resize',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#3b82f6'; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.background = '#3e3e42'; }}
          />

          {/* Editor + Terminal */}
          <Panel defaultSize={config.panels.sandbox.editor.default} minSize={30}>
            <PanelGroup direction="vertical">
              {/* Editor area */}
              <Panel defaultSize={config.panels.sandbox.editorArea.default} minSize={20}>
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
                  {splitFile && activeFile ? (
                    /* Split view */
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <PanelGroup direction="horizontal">
                        <Panel defaultSize={50} minSize={25}>
                          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <EditorTabs
                              tabs={leftTabs}
                              activeTab={activeFile}
                              onTabSelect={handleFileSelect}
                              onTabClose={handleTabClose}
                              onSplitToggle={handleSplitToggle}
                              isSplit={true}
                              onCopy={handleCopyFile}
                            />
                            <div style={{ flex: 1 }}>
                              <CodeEditor
                                value={currentFileContent}
                                language={getLanguage(activeFile)}
                                onChange={handleEditorChange}
                                path={activeFile}
                              />
                            </div>
                          </div>
                        </Panel>

                        <PanelResizeHandle
                          style={{
                            width: '4px',
                            background: '#3e3e42',
                            cursor: 'col-resize',
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#3b82f6'; }}
                          onMouseLeave={(e) => { (e.target as HTMLElement).style.background = '#3e3e42'; }}
                        />

                        <Panel defaultSize={50} minSize={25}>
                          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <EditorTabs
                              tabs={rightTabs}
                              activeTab={splitFile}
                              onTabSelect={handleSplitFileSelect}
                              onTabClose={handleSplitTabClose}
                              onSplitToggle={handleSplitToggle}
                              side="right"
                            />
                            <div style={{ flex: 1 }}>
                              <CodeEditor
                                value={splitFileContent}
                                language={getLanguage(splitFile)}
                                onChange={handleSplitEditorChange}
                                path={`split:${splitFile}`}
                              />
                            </div>
                          </div>
                        </Panel>
                      </PanelGroup>
                    </div>
                  ) : (
                    /* Single editor */
                    <>
                      <EditorTabs
                        tabs={openTabs}
                        activeTab={activeFile}
                        onTabSelect={handleFileSelect}
                        onTabClose={handleTabClose}
                        onSplitToggle={openTabs.length > 0 ? handleSplitToggle : undefined}
                        isSplit={false}
                        onCopy={activeFile ? handleCopyFile : undefined}
                      />
                      <div style={{ flex: 1 }}>
                        {activeFile ? (
                          <CodeEditor
                            value={currentFileContent}
                            language={getLanguage(activeFile)}
                            onChange={handleEditorChange}
                            path={activeFile}
                          />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' }}>
                            Select a file to edit
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </Panel>

              <PanelResizeHandle
                style={{
                  height: '4px',
                  background: '#3e3e42',
                  cursor: 'row-resize',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#3b82f6'; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.background = '#3e3e42'; }}
              />

              {/* Terminal */}
              <Panel
                ref={terminalPanelRef}
                defaultSize={config.panels.sandbox.terminal.default}
                minSize={config.panels.sandbox.terminal.min}
                collapsible
                collapsedSize={0}
              >
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div
                    style={{
                      background: '#2d2d30',
                      color: '#ccc',
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      borderBottom: '1px solid #3e3e42',
                    }}
                  >
                    Terminal
                  </div>
                  <div style={{ flex: 1, background: '#1e1e1e' }}>
                    <Terminal onTerminalReady={handleTerminalReady} isWebContainerReady={isReady} />
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>

      {/* WebContainer provider (headless) */}
      <WebContainerProvider
        ref={webcontainerRef}
        files={currentFiles}
        terminal={terminal}
        onStateChange={setContainerState}
      />

      {/* Loading overlay */}
      <LoadingOverlay state={containerState} />

      {/* Dialogs */}
      <SaveDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSave={handleSave}
      />
      <LoadDialog
        isOpen={showLoadDialog}
        onClose={() => setShowLoadDialog(false)}
        onLoad={handleLoad}
        onDelete={handleDelete}
        saves={namedSaves}
        autoSave={autoSave}
      />

      {/* Template Dialog */}
      {showTemplateDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: config.zIndex.menu,
          }}
          onClick={() => setShowTemplateDialog(false)}
        >
          <div
            role="dialog"
            aria-labelledby="template-dialog-title"
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '1.5rem',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="template-dialog-title" style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Choose a Template</h2>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              Starting a new project? Select an architectural template to get started.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {SANDBOX_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    loadTemplate(template);
                    setShowTemplateDialog(false);
                  }}
                  style={{
                    background: 'white',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '1rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.borderColor = '#3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.borderColor = '#e5e7eb';
                  }}
                >
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>
                    {template.name}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.875rem' }}>{template.description}</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                    {template.files.length} files
                  </div>
                </button>
              ))}
            </div>

            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
              <button
                onClick={() => setShowTemplateDialog(false)}
                style={{
                  background: '#64748b',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  width: '100%',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  );
}
