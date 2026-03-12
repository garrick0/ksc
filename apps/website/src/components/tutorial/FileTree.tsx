'use client';

import React, { useState, useMemo } from 'react';
import { LessonFile } from '@/lib/lessons/types';

interface FileTreeProps {
  files: LessonFile[];
  activeFile: string;
  onFileSelect: (path: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children: TreeNode[];
  fileCount?: number;
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

export function FileTree({ files, activeFile, onFileSelect }: FileTreeProps) {
  const tree = useMemo(() => buildTree(files), [files]);

  // Smart defaults: expand lesson files (src/), collapse reference (storybook/)
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    // Expand src/ and its immediate children by default
    tree.children.forEach((node) => {
      if (node.type === 'folder' && node.name === 'src') {
        initial.add(node.path);
        // Also expand one level deep in src/
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
    if (node.type === 'file') {
      const isActive = node.path === activeFile;
      return [
        <div
          key={node.path}
          role="treeitem"
          aria-selected={isActive}
          onClick={() => onFileSelect(node.path)}
          style={{
            padding: '0.375rem 0.75rem',
            paddingLeft: `${0.75 + depth * 0.75}rem`,
            cursor: 'pointer',
            background: isActive ? '#37373d' : 'transparent',
            color: isActive ? 'white' : '#cccccc',
            fontSize: '0.875rem',
            borderLeft: isActive ? '2px solid #007acc' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span style={{ opacity: 0.5, fontSize: '0.75rem' }}>📄</span>
          <span>{node.name}</span>
        </div>,
      ];
    }

    const isExpanded = expanded.has(node.path);
    const elements: React.JSX.Element[] = [];

    // Folder header
    elements.push(
      <div
        key={node.path}
        role="treeitem"
        aria-expanded={isExpanded}
        onClick={() => toggleFolder(node.path)}
        style={{
          padding: '0.375rem 0.75rem',
          paddingLeft: `${0.75 + depth * 0.75}rem`,
          cursor: 'pointer',
          background: 'transparent',
          color: '#cccccc',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: '0.625rem', width: '0.75rem', textAlign: 'center' }}>
          {isExpanded ? '▼' : '▶'}
        </span>
        <span style={{ opacity: 0.5, fontSize: '0.75rem' }}>{isExpanded ? '📂' : '📁'}</span>
        <span>{node.name}</span>
        {node.fileCount && (
          <span style={{ opacity: 0.5, fontSize: '0.75rem', marginLeft: 'auto' }}>
            ({node.fileCount})
          </span>
        )}
      </div>
    );

    // Folder children (if expanded)
    if (isExpanded) {
      node.children.forEach((child) => {
        elements.push(...renderNode(child, depth + 1));
      });
    }

    return elements;
  };

  return (
    <div style={{ background: '#252526', color: '#cccccc', height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#888' }}>
        Files
      </div>

      {/* Search box */}
      <div style={{ padding: '0 0.75rem 0.5rem' }}>
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
        {filteredTree.children.map((child) => renderNode(child))}
      </div>
    </div>
  );
}
