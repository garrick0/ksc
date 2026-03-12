'use client';

import Editor, { BeforeMount } from '@monaco-editor/react';
import { KINDSCRIPT_TYPES } from '@/lib/lessons/kindscript-types';
import { config } from '@/lib/config';

interface CodeEditorProps {
  value: string;
  language: string;
  onChange?: (value: string | undefined) => void;
  path?: string;
}

const handleEditorWillMount: BeforeMount = (monaco) => {
  // Configure TypeScript compiler options
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
  });

  // Add kindscript type declarations
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    KINDSCRIPT_TYPES,
    'kindscript.d.ts'
  );
};

export function CodeEditor({ value, language, onChange, path }: CodeEditorProps) {
  return (
    <Editor
      height="100%"
      language={language}
      value={value}
      onChange={onChange}
      path={path}
      theme="vs-dark"
      beforeMount={handleEditorWillMount}
      options={{
        minimap: { enabled: false },
        fontSize: config.editor.fontSize,
        lineNumbers: 'on',
        wordWrap: 'on',
        automaticLayout: true,
        scrollBeyondLastLine: false,
        readOnly: false,
        tabSize: config.editor.tabSize,
        insertSpaces: true,
      }}
    />
  );
}
