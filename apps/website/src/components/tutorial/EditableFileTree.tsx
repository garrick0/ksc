'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { LessonFile } from '@/lib/lessons/types';

interface EditableFileTreeProps {
  files: LessonFile[];
  activeFile: string | null;
  onFileSelect: (path: string) => void;
  onCreateFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
  onRenameFile: (oldPath: string, newPath: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children: TreeNode[];
  fileCount?: number;
}

function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (filename === 'package.json') return '📦';
  if (filename === 'tsconfig.json') return '⚙️';
  if (filename.endsWith('.config.ts') || filename.endsWith('.config.js')) return '⚙️';
  if (filename.includes('test') || filename.includes('.spec.')) return '🧪';
  if (filename.includes('stories')) return '📖';
  if (filename.endsWith('.md') || filename.endsWith('.mdx')) return '📝';

  switch (ext) {
    case 'ts':
    case 'tsx':
      return '🔷';
    case 'js':
    case 'jsx':
      return '🟨';
    case 'json':
      return '📋';
    case 'css':
    case 'scss':
      return '🎨';
    case 'html':
      return '🌐';
    case 'yml':
    case 'yaml':
      return '📄';
    case 'env':
      return '🔐';
    case 'sh':
      return '⚡';
    default:
      return '📄';
  }
}

function buildTree(files: LessonFile[]): TreeNode {
  const root: TreeNode = { name: '', path: '', type: 'folder', children: [] };

  files.forEach((file) => {
    const parts = file.path.split('/');
    let current = root;

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      const path = parts.slice(0, index + 1).join('/');

      let child = current.children.find((c) => c.name === part);

      if (!child) {
        child = {
          name: part,
          path,
          type: isFile ? 'file' : 'folder',
          children: [],
        };
        current.children.push(child);
      }

      current = child;
    });
  });

  // Count files in each folder
  function countFiles(node: TreeNode): number {
    if (node.type === 'file') return 1;
    const count = node.children.reduce((sum, child) => sum + countFiles(child), 0);
    node.fileCount = count;
    return count;
  }
  countFiles(root);

  return root;
}

export function EditableFileTree({
  files,
  activeFile,
  onFileSelect,
  onCreateFile,
  onDeleteFile,
  onRenameFile,
}: EditableFileTreeProps) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    tree.children.forEach((node) => {
      if (node.type === 'folder' && node.name === 'src') {
        initial.add(node.path);
        node.children.forEach((child) => {
          if (child.type === 'folder') {
            initial.add(child.path);
          }
        });
      }
    });
    return initial;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{ path: string; x: number; y: number; type: 'file' | 'folder' } | null>(
    null
  );
  const [creating, setCreating] = useState<{ parentPath: string; type: 'file' | 'folder' } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newNameInput, setNewNameInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when creating or renaming
  useEffect(() => {
    if ((creating || renaming) && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [creating, renaming]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  const toggleFolder = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ path: node.path, x: e.clientX, y: e.clientY, type: node.type });
  };

  const handleCreate = (parentPath: string, type: 'file' | 'folder') => {
    setCreating({ parentPath, type });
    setNewNameInput(type === 'file' ? 'new-file.ts' : 'new-folder');
    setContextMenu(null);
    // Expand parent folder if creating inside it
    if (parentPath) {
      setExpanded((prev) => new Set(prev).add(parentPath));
    }
  };

  const handleDelete = (path: string) => {
    if (confirm(`Are you sure you want to delete "${path}"?`)) {
      onDeleteFile(path);
    }
    setContextMenu(null);
  };

  const handleRenameStart = (path: string) => {
    const fileName = path.split('/').pop() || '';
    setRenaming(path);
    setNewNameInput(fileName);
    setContextMenu(null);
  };

  const commitCreate = () => {
    if (!creating || !newNameInput.trim()) {
      setCreating(null);
      return;
    }

    const fullPath = creating.parentPath ? `${creating.parentPath}/${newNameInput.trim()}` : newNameInput.trim();

    if (creating.type === 'file') {
      // Check if file already exists
      if (files.find((f) => f.path === fullPath)) {
        alert('File already exists');
        return;
      }
      onCreateFile(fullPath);
    } else {
      // For folders, create a placeholder file
      const placeholderPath = `${fullPath}/.gitkeep`;
      if (!files.find((f) => f.path === placeholderPath)) {
        onCreateFile(placeholderPath);
      }
    }

    setCreating(null);
    setNewNameInput('');
  };

  const commitRename = () => {
    if (!renaming || !newNameInput.trim()) {
      setRenaming(null);
      return;
    }

    const parts = renaming.split('/');
    parts[parts.length - 1] = newNameInput.trim();
    const newPath = parts.join('/');

    if (newPath !== renaming) {
      // Check if target already exists
      if (files.find((f) => f.path === newPath)) {
        alert('A file with that name already exists');
        return;
      }
      onRenameFile(renaming, newPath);
    }

    setRenaming(null);
    setNewNameInput('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (creating) commitCreate();
      if (renaming) commitRename();
    } else if (e.key === 'Escape') {
      setCreating(null);
      setRenaming(null);
      setNewNameInput('');
    }
  };

  const filterTree = (node: TreeNode, query: string): TreeNode | null => {
    if (!query) return node;

    const lowerQuery = query.toLowerCase();

    if (node.type === 'file') {
      return node.name.toLowerCase().includes(lowerQuery) ? node : null;
    }

    const filteredChildren = node.children
      .map((child) => filterTree(child, query))
      .filter((child): child is TreeNode => child !== null);

    if (filteredChildren.length === 0) return null;

    return { ...node, children: filteredChildren };
  };

  const filteredTree = useMemo(() => {
    const filtered = filterTree(tree, searchQuery);
    return filtered || tree;
  }, [tree, searchQuery]);

  const renderNode = (node: TreeNode, depth: number = 0): React.JSX.Element[] => {
    const elements: React.JSX.Element[] = [];

    // Render file
    if (node.type === 'file') {
      const isActive = node.path === activeFile;
      const isRenaming = renaming === node.path;

      elements.push(
        <div
          key={node.path}
          role="treeitem"
          aria-selected={isActive}
          onClick={() => !isRenaming && onFileSelect(node.path)}
          onContextMenu={(e) => handleContextMenu(e, node)}
          onMouseEnter={(e) => !isActive && (e.currentTarget.style.background = '#2a2d2e')}
          onMouseLeave={(e) => !isActive && (e.currentTarget.style.background = 'transparent')}
          style={{
            padding: '0.5rem 0.75rem',
            paddingLeft: `${0.75 + depth * 1}rem`,
            cursor: isRenaming ? 'default' : 'pointer',
            background: isActive ? '#094771' : 'transparent',
            color: isActive ? '#ffffff' : '#d4d4d4',
            fontSize: '0.9375rem',
            borderLeft: isActive ? '3px solid #0e639c' : '3px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            transition: 'background-color 0.15s ease, border-color 0.15s ease',
            borderRadius: '2px',
            margin: '0 4px',
          }}
        >
          <span style={{
            opacity: isActive ? 1 : 0.7,
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
          }}>
            {getFileIcon(node.name)}
          </span>
          {isRenaming ? (
            <input
              ref={inputRef}
              type="text"
              value={newNameInput}
              onChange={(e) => setNewNameInput(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleInputKeyDown}
              style={{
                background: '#3c3c3c',
                border: '1px solid #007acc',
                borderRadius: '2px',
                color: 'white',
                fontSize: '0.875rem',
                padding: '0.125rem 0.25rem',
                outline: 'none',
                flex: 1,
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span>{node.name}</span>
          )}
        </div>
      );
      return elements;
    }

    // Render folder
    const isExpanded = expanded.has(node.path);
    const isRenaming = renaming === node.path;

    elements.push(
      <div
        key={node.path}
        role="treeitem"
        aria-expanded={isExpanded}
        onClick={() => !isRenaming && toggleFolder(node.path)}
        onContextMenu={(e) => handleContextMenu(e, node)}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2d2e')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        style={{
          padding: '0.5rem 0.75rem',
          paddingLeft: `${0.75 + depth * 1}rem`,
          cursor: isRenaming ? 'default' : 'pointer',
          background: 'transparent',
          color: '#d4d4d4',
          fontSize: '0.9375rem',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          userSelect: 'none',
          transition: 'background-color 0.15s ease',
          borderRadius: '2px',
          margin: '0 4px',
        }}
      >
        <span style={{
          fontSize: '0.6875rem',
          width: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.15s ease',
          transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
        }}>
          ▼
        </span>
        <span style={{
          fontSize: '1rem',
          opacity: 0.9,
          display: 'flex',
          alignItems: 'center',
        }}>
          {isExpanded ? '📂' : '📁'}
        </span>
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={newNameInput}
            onChange={(e) => setNewNameInput(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleInputKeyDown}
            style={{
              background: '#3c3c3c',
              border: '1px solid #007acc',
              borderRadius: '2px',
              color: 'white',
              fontSize: '0.875rem',
              padding: '0.125rem 0.25rem',
              outline: 'none',
              flex: 1,
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <span style={{ flex: 1 }}>{node.name}</span>
            {node.fileCount && node.fileCount > 0 && (
              <span style={{
                opacity: 0.4,
                fontSize: '0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '0.125rem 0.375rem',
                borderRadius: '10px',
                fontWeight: 400,
                minWidth: '1.5rem',
                textAlign: 'center',
              }}>
                {node.fileCount}
              </span>
            )}
          </>
        )}
      </div>
    );

    // Render children if expanded
    if (isExpanded) {
      // Render existing children
      node.children.forEach((child) => {
        elements.push(...renderNode(child, depth + 1));
      });

      // Render create input if creating in this folder
      if (creating && creating.parentPath === node.path) {
        elements.push(
          <div
            key="__creating__"
            style={{
              padding: '0.375rem 0.75rem',
              paddingLeft: `${0.75 + (depth + 1) * 0.75}rem`,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span style={{ opacity: 0.5, fontSize: '0.75rem' }}>
              {creating.type === 'file' ? '📄' : '📁'}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={newNameInput}
              onChange={(e) => setNewNameInput(e.target.value)}
              onBlur={commitCreate}
              onKeyDown={handleInputKeyDown}
              style={{
                background: '#3c3c3c',
                border: '1px solid #007acc',
                borderRadius: '2px',
                color: 'white',
                fontSize: '0.875rem',
                padding: '0.125rem 0.25rem',
                outline: 'none',
                flex: 1,
              }}
            />
          </div>
        );
      }
    }

    return elements;
  };

  return (
    <div
      style={{ background: '#252526', color: '#cccccc', height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' }}
    >
      {/* Header with create buttons */}
      <div
        style={{
          padding: '0.5rem 0.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #3e3e42',
        }}
      >
        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#888' }}>Files</div>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button
            onClick={() => handleCreate('src', 'file')}
            title="New file in src/"
            aria-label="New file in src/"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              fontSize: '0.875rem',
              padding: '0.125rem 0.25rem',
            }}
          >
            📄+
          </button>
          <button
            onClick={() => handleCreate('src', 'folder')}
            title="New folder in src/"
            aria-label="New folder in src/"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              fontSize: '0.875rem',
              padding: '0.125rem 0.25rem',
            }}
          >
            📁+
          </button>
        </div>
      </div>

      {/* Search box */}
      <div style={{ padding: '0.5rem 0.75rem' }}>
        <input
          type="text"
          aria-label="Search files"
          placeholder="🔍 Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '0.375rem 0.5rem',
            background: '#3c3c3c',
            border: '1px solid #555',
            borderRadius: '0.25rem',
            color: '#cccccc',
            fontSize: '0.875rem',
            outline: 'none',
          }}
        />
      </div>

      {/* File tree */}
      <div role="tree" aria-label="File explorer" style={{ flex: 1, overflow: 'auto' }}>
        {/* Show create input at root level if creating at root */}
        {creating && creating.parentPath === '' && (
          <div
            style={{
              padding: '0.375rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span style={{ opacity: 0.5, fontSize: '0.75rem' }}>
              {creating.type === 'file' ? '📄' : '📁'}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={newNameInput}
              onChange={(e) => setNewNameInput(e.target.value)}
              onBlur={commitCreate}
              onKeyDown={handleInputKeyDown}
              style={{
                background: '#3c3c3c',
                border: '1px solid #007acc',
                borderRadius: '2px',
                color: 'white',
                fontSize: '0.875rem',
                padding: '0.125rem 0.25rem',
                outline: 'none',
                flex: 1,
              }}
            />
          </div>
        )}
        {filteredTree.children.map((child) => renderNode(child))}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          role="menu"
          aria-label="File actions"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: '#2d2d30',
            border: '1px solid #555',
            borderRadius: '4px',
            padding: '0.25rem 0',
            zIndex: 1000,
            minWidth: '150px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'folder' && (
            <>
              <div
                role="menuitem"
                onClick={() => handleCreate(contextMenu.path, 'file')}
                style={{
                  padding: '0.375rem 0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  color: '#cccccc',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#37373d')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                📄 New File
              </div>
              <div
                role="menuitem"
                onClick={() => handleCreate(contextMenu.path, 'folder')}
                style={{
                  padding: '0.375rem 0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  color: '#cccccc',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#37373d')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                📁 New Folder
              </div>
              <div style={{ height: '1px', background: '#555', margin: '0.25rem 0' }} />
            </>
          )}
          <div
            role="menuitem"
            onClick={() => handleRenameStart(contextMenu.path)}
            style={{
              padding: '0.375rem 0.75rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              color: '#cccccc',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#37373d')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            ✏️ Rename
          </div>
          <div
            role="menuitem"
            onClick={() => handleDelete(contextMenu.path)}
            style={{
              padding: '0.375rem 0.75rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              color: '#ef4444',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#37373d')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            🗑️ Delete
          </div>
        </div>
      )}
    </div>
  );
}
