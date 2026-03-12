'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels';
import { Lesson, LessonFile } from '@/lib/lessons/types';
import { LessonContent } from './LessonContent';
import { LessonNav } from './LessonNav';
import { FileTree } from './FileTree';
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

interface TutorialLayoutProps {
  lesson: Lesson;
}

export function TutorialLayout({ lesson }: TutorialLayoutProps) {
  const [showSolution, setShowSolution] = useState(false);
  const [containerState, setContainerState] = useState<'idle' | 'booting' | 'installing' | 'ready' | 'error'>('idle');
  const [terminal, setTerminal] = useState<any>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const webcontainerRef = useRef<WebContainerHandle>(null);
  const lessonPanelRef = useRef<ImperativePanelHandle>(null);
  const terminalPanelRef = useRef<ImperativePanelHandle>(null);
  const { showToast, ToastContainer } = useToast();

  const fileState = useLessonFiles({
    initialFiles: lesson.files,
    initialFocus: lesson.focus,
    onDirty: () => setIsDirty(true),
  });

  const {
    currentFiles, activeFile, openTabs, splitFile,
    handleFileSelect, handleTabClose, handleSplitToggle,
    handleSplitFileSelect, handleSplitTabClose, handleFileChange,
    resetFiles, setCurrentFiles,
    currentFileContent, splitFileContent, leftTabs, rightTabs,
  } = fileState;

  useAutoSave({ slug: lesson.slug, files: currentFiles, activeFile, isDirty });

  const handleTerminalReady = (term: any) => {
    setTerminal(term);
  };

  // Check for auto-save when lesson loads
  useEffect(() => {
    const autoSave = storage.loadAutoSave(lesson.slug);
    if (autoSave && !areFilesEqual(autoSave.files, lesson.files)) {
      setShowResumeBanner(true);
    } else {
      setShowResumeBanner(false);
    }
  }, [lesson.slug, lesson.files]);

  // Reset when lesson changes
  useEffect(() => {
    resetFiles(lesson.files, lesson.focus);
    setShowSolution(false);
    setIsDirty(false);
  }, [lesson.slug, lesson.files, lesson.focus, resetFiles]);

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

  const handleShowSolution = () => {
    setCurrentFiles(lesson.solution);
    setShowSolution(true);
    setIsDirty(false);
    storage.clearAutoSave(lesson.slug);
  };

  const handleReset = () => {
    resetFiles(lesson.files, lesson.focus);
    setShowSolution(false);
    setIsDirty(false);
    storage.clearAutoSave(lesson.slug);
    showToast('Reset to starter files', 'info');
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined || !activeFile) return;
    handleFileChange(activeFile, value, (p, v) => webcontainerRef.current?.writeFile(p, v));
  };

  const handleSplitEditorChange = (value: string | undefined) => {
    if (value === undefined || !splitFile) return;
    handleFileChange(splitFile, value, (p, v) => webcontainerRef.current?.writeFile(p, v));
  };

  const handleSave = useCallback((name: string) => {
    try {
      storage.namedSave(lesson.slug, name, currentFiles, activeFile || lesson.focus);
      showToast(`Saved as "${name}"`, 'success');
    } catch (error) {
      showToast('Failed to save: storage quota exceeded', 'error');
    }
  }, [lesson.slug, currentFiles, activeFile, showToast]);

  const handleLoad = useCallback((save: storage.SavedLesson) => {
    resetFiles(save.files, save.activeFile);
    setShowSolution(false);
    setIsDirty(false);
    const label = save.slotName === null ? 'Auto-save' : save.label || save.slotName;
    showToast(`Loaded "${label}"`, 'success');
  }, [showToast, resetFiles]);

  const handleDelete = useCallback((save: storage.SavedLesson) => {
    if (save.slotName === null) {
      storage.clearAutoSave(lesson.slug);
    } else {
      storage.deleteNamedSave(lesson.slug, save.slotName);
    }
    showToast('Save deleted', 'info');
  }, [lesson.slug, showToast]);

  const handleExport = useCallback(async () => {
    try {
      const projectName = `kindscript-${lesson.slug}`;
      await downloadAsZip(currentFiles, projectName);
      showToast('Downloaded ZIP file', 'success');
    } catch (error) {
      showToast('Failed to download ZIP', 'error');
    }
  }, [currentFiles, lesson.slug, showToast]);

  const handleRestoreAutoSave = () => {
    const autoSave = storage.loadAutoSave(lesson.slug);
    if (autoSave) {
      handleLoad(autoSave);
      setShowResumeBanner(false);
    }
  };

  const handleDismissResumeBanner = () => {
    setShowResumeBanner(false);
    storage.clearAutoSave(lesson.slug);
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

  const getLanguage = (path: string | null) => {
    if (!path) return 'plaintext';
    if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
    if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.md')) return 'markdown';
    return 'plaintext';
  };

  const isReady = containerState === 'ready';

  const namedSaves = storage.listNamedSaves(lesson.slug);
  const autoSave = storage.loadAutoSave(lesson.slug);


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
            ← Lessons
          </a>
          <div style={{ color: '#94a3b8' }}>|</div>
          <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>{lesson.partTitle}</div>
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

          {!showSolution && (
            <button
              onClick={handleShowSolution}
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
              Show Solution
            </button>
          )}
          {showSolution && (
            <button
              onClick={handleReset}
              style={{
                background: '#64748b',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Reset
            </button>
          )}

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
          {/* Left panel: Lesson content */}
          <Panel
            ref={lessonPanelRef}
            defaultSize={config.panels.tutorial.content.default}
            minSize={config.panels.tutorial.content.min}
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
              }}
            >
              <LessonContent lesson={lesson} />
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
          <Panel defaultSize={config.panels.tutorial.fileTree.default} minSize={config.panels.tutorial.fileTree.min} maxSize={config.panels.tutorial.fileTree.max} collapsible collapsedSize={0}>
            <div style={{ height: '100%', borderRight: '1px solid #3e3e42' }}>
              <FileTree files={currentFiles} activeFile={activeFile || ''} onFileSelect={handleFileSelect} />
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
          <Panel defaultSize={config.panels.tutorial.editor.default} minSize={30}>
            <PanelGroup direction="vertical">
              {/* Editor area */}
              <Panel defaultSize={config.panels.tutorial.editorArea.default} minSize={20}>
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
                  {splitFile ? (
                    /* Split view: two editors side by side */
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <PanelGroup direction="horizontal">
                        {/* Left editor */}
                        <Panel defaultSize={50} minSize={25}>
                          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <EditorTabs
                              tabs={leftTabs}
                              activeTab={activeFile}
                              onTabSelect={handleFileSelect}
                              onTabClose={handleTabClose}
                              onSplitToggle={handleSplitToggle}
                              isSplit={true}
                              showSolution={showSolution}
                              onCopy={handleCopyFile}
                            />
                            <div style={{ flex: 1 }}>
                              <CodeEditor
                                value={currentFileContent}
                                language={getLanguage(activeFile)}
                                onChange={handleEditorChange}
                                path={activeFile || undefined}
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

                        {/* Right editor */}
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
                        onSplitToggle={handleSplitToggle}
                        isSplit={false}
                        showSolution={showSolution}
                        onCopy={handleCopyFile}
                      />
                      <div style={{ flex: 1 }}>
                        <CodeEditor
                          value={currentFileContent}
                          language={getLanguage(activeFile)}
                          onChange={handleEditorChange}
                          path={activeFile || undefined}
                        />
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
                defaultSize={config.panels.tutorial.terminal.default}
                minSize={config.panels.tutorial.terminal.min}
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

      {/* Bottom nav */}
      <LessonNav lesson={lesson} />

      {/* WebContainer provider (headless) */}
      <WebContainerProvider
        ref={webcontainerRef}
        files={currentFiles}
        terminal={terminal}
        onStateChange={setContainerState}
      />

      {/* Loading overlay */}
      <LoadingOverlay state={containerState} />

      {/* Save/Load dialogs */}
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

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  );
}

// Helper function to compare file arrays
function areFilesEqual(a: LessonFile[], b: LessonFile[]): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (a[i].path !== b[i].path || a[i].contents !== b[i].contents) {
      return false;
    }
  }

  return true;
}
