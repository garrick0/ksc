'use client';

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { WebContainer } from '@webcontainer/api';
import type { Terminal as XTerm } from '@xterm/xterm';
import { LessonFile } from '@/lib/lessons/types';
import { templateFiles } from '@/lib/lessons/template';
import { filesToFileSystemTree } from '@/lib/webcontainer/utils';
import { getWebContainer, isWebContainerBooted, isDependenciesInstalled, markDependenciesInstalled } from '@/lib/webcontainer/singleton';
import { config } from '@/lib/config';

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

type LoadingState = 'idle' | 'booting' | 'installing' | 'ready' | 'error';

interface WebContainerProviderProps {
  files: LessonFile[];
  terminal: XTerm | null;
  onStateChange?: (state: LoadingState) => void;
}

export interface WebContainerHandle {
  writeFile: (path: string, contents: string) => Promise<void>;
  runCommand: (command: string, args: string[]) => Promise<void>;
}

export const WebContainerProvider = forwardRef<WebContainerHandle, WebContainerProviderProps>(
  ({ files, terminal, onStateChange }, ref) => {
    const instanceRef = useRef<WebContainer | null>(null);
    const [state, setState] = useState<LoadingState>('idle');
    const hasBooted = useRef(false);
    const writeQueueRef = useRef<Map<string, string>>(new Map());
    const writeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
      if (state !== 'idle') {
        onStateChange?.(state);
      }
    }, [state, onStateChange]);

    const writeFile = useCallback(async (path: string, contents: string) => {
      if (!instanceRef.current || state !== 'ready') return;

      // Queue writes and debounce
      writeQueueRef.current.set(path, contents);

      if (writeTimeoutRef.current) {
        clearTimeout(writeTimeoutRef.current);
      }

      writeTimeoutRef.current = setTimeout(async () => {
        const wc = instanceRef.current;
        if (!wc) return;

        for (const [filePath, fileContents] of writeQueueRef.current.entries()) {
          try {
            await wc.fs.writeFile(filePath, fileContents);
          } catch {
            // File write failures are non-fatal — the user can retry by editing again
          }
        }
        writeQueueRef.current.clear();
      }, 300); // 300ms debounce
    }, [state]);

    const runCommand = useCallback(async (command: string, args: string[]) => {
      if (!instanceRef.current || !terminal || state !== 'ready') return;

      try {
        terminal.writeln(`$ ${command} ${args.join(' ')}`);
        const process = await instanceRef.current.spawn(command, args);

        process.output.pipeTo(
          new WritableStream({
            write(data) {
              terminal.write(data);
            },
          })
        );

        const exitCode = await process.exit;
        if (exitCode === 0) {
          terminal.writeln('\r\n✓ Command completed successfully');
        } else {
          terminal.writeln(`\r\n✗ Command failed with exit code ${exitCode}`);
        }
      } catch (error) {
        terminal.writeln(`\r\n✗ Error: ${error}`);
      }
    }, [terminal, state]);

    useImperativeHandle(ref, () => ({
      writeFile,
      runCommand,
    }));

    useEffect(() => {
      if (!terminal) return;

      async function boot() {
        if (!terminal) return;

        // Reuse existing instance across lesson navigation
        const alreadyBooted = isWebContainerBooted();

        if (alreadyBooted && !instanceRef.current) {
          try {
            const wc = await getWebContainer();
            instanceRef.current = wc;
            setState('ready');
            terminal.writeln('✓ WebContainer ready (cached)');

            const shellProcess = await wc.spawn('jsh', {
              terminal: { cols: terminal.cols, rows: terminal.rows },
            });

            shellProcess.output.pipeTo(
              new WritableStream({ write(data) { terminal.write(data); } })
            );

            const input = shellProcess.input.getWriter();
            terminal.onData((data) => { input.write(data); });
            return;
          } catch {
            setState('error');
            return;
          }
        }

        if (hasBooted.current) return;
        hasBooted.current = true;

        // Check browser support
        if (typeof SharedArrayBuffer === 'undefined' || !crossOriginIsolated) {
          setState('error');
          terminal.writeln('❌ WebContainer not supported in this browser');
          terminal.writeln('SharedArrayBuffer: ' + (typeof SharedArrayBuffer !== 'undefined' ? 'available' : 'not available'));
          terminal.writeln('Cross-origin isolated: ' + (crossOriginIsolated ? 'yes' : 'no'));
          terminal.writeln('');
          terminal.writeln('If you are seeing this in development mode, try:');
          terminal.writeln('1. Restart the dev server (Ctrl+C then npm run dev)');
          terminal.writeln('2. Hard refresh your browser (Cmd+Shift+R or Ctrl+Shift+R)');
          terminal.writeln('3. Clear browser cache for localhost:3000');
          return;
        }

        setState('booting');
        terminal.writeln('Booting WebContainer...');

        try {
          // Boot with timeout
          const wc = await withTimeout(getWebContainer(), config.webcontainer.bootTimeoutMs, 'WebContainer boot timed out');
          instanceRef.current = wc;

          terminal.writeln('Mounting files...');
          await wc.mount(templateFiles);

          // Skip npm install if dependencies already installed
          if (!isDependenciesInstalled()) {
            setState('installing');
            terminal.writeln('Installing dependencies...');
            terminal.writeln('This may take 30-60 seconds on first load...');

            const installProcess = await wc.spawn('npm', ['install']);
            installProcess.output.pipeTo(
              new WritableStream({ write(data) { terminal.write(data); } })
            );

            // Install with timeout
            const exitCode = await withTimeout(installProcess.exit, config.webcontainer.installTimeoutMs, 'npm install timed out');
            if (exitCode !== 0) {
              terminal.writeln(`\r\n✗ npm install failed with exit code ${exitCode}`);
              setState('error');
              return;
            }

            terminal.writeln('\r\n✓ Dependencies installed');
            markDependenciesInstalled();
          } else {
            terminal.writeln('✓ Dependencies already installed');
          }

          setState('ready');
          terminal.writeln('\r\n=== Ready! ===');
          terminal.writeln('Type commands or click "Run Check" to validate the architecture.\r\n');

          const shellProcess = await wc.spawn('jsh', {
            terminal: { cols: terminal.cols, rows: terminal.rows },
          });

          shellProcess.output.pipeTo(
            new WritableStream({ write(data) { terminal.write(data); } })
          );

          const input = shellProcess.input.getWriter();
          terminal.onData((data) => { input.write(data); });
        } catch (error) {
          setState('error');
          terminal.writeln(`\r\n❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      boot();
    }, [terminal]);

    // Update files when lesson changes
    useEffect(() => {
      if (!instanceRef.current || state !== 'ready') return;

      async function updateFiles() {
        const wc = instanceRef.current!;
        const lessonTree = filesToFileSystemTree(files);

        try {
          await wc.mount(lessonTree);
          if (terminal) {
            terminal.writeln('\r\n📝 Lesson files updated');
          }
        } catch {
          // Mount failure is non-fatal — user can re-save the file to retry
        }
      }

      updateFiles();
    }, [files, state, terminal]);

    return null;
  }
);

WebContainerProvider.displayName = 'WebContainerProvider';
