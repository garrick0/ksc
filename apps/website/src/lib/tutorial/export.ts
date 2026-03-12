import JSZip from 'jszip';
import type { FileNode } from '@webcontainer/api';
import { LessonFile } from '../lessons/types';
import { templateFiles } from '../lessons/template';

/**
 * Download the current lesson files as a ZIP archive
 * Includes template files (package.json, tsconfig.json) and all lesson files
 */
export async function downloadAsZip(
  files: LessonFile[],
  projectName: string = 'kindscript-project'
): Promise<void> {
  const zip = new JSZip();

  // Add template files
  const packageJsonNode = templateFiles['package.json'] as FileNode;
  const tsconfigJsonNode = templateFiles['tsconfig.json'] as FileNode;

  const pkgFileContents = packageJsonNode.file.contents;
  const tsFileContents = tsconfigJsonNode.file.contents;

  const packageJson = JSON.parse(typeof pkgFileContents === 'string' ? pkgFileContents : new TextDecoder().decode(pkgFileContents));
  const tsconfigJson = JSON.parse(typeof tsFileContents === 'string' ? tsFileContents : new TextDecoder().decode(tsFileContents));

  zip.file('package.json', JSON.stringify(packageJson, null, 2));
  zip.file('tsconfig.json', JSON.stringify(tsconfigJson, null, 2));

  // Add README with instructions
  const readme = `# ${projectName}

This project was exported from the KindScript interactive tutorial.

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Run KindScript checker
npm run check
\`\`\`

## What's included

- \`package.json\` - Project dependencies (kindscript, typescript)
- \`tsconfig.json\` - TypeScript configuration
- \`src/\` - Your source files

## Learn More

Visit https://kindscript.ai for documentation and tutorials.
`;

  zip.file('README.md', readme);

  // Add lesson files
  for (const file of files) {
    zip.file(file.path, file.contents);
  }

  // Generate and download
  try {
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to generate ZIP:', error);
    throw new Error('Failed to generate ZIP file');
  }
}

/**
 * Copy file contents to clipboard
 * Returns true if successful, false otherwise
 */
export async function copyFileToClipboard(contents: string): Promise<boolean> {
  if (!navigator.clipboard) {
    // Fallback for older browsers
    return fallbackCopyToClipboard(contents);
  }

  try {
    await navigator.clipboard.writeText(contents);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return fallbackCopyToClipboard(contents);
  }
}

/**
 * Fallback copy method for browsers without Clipboard API
 */
function fallbackCopyToClipboard(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  } catch (error) {
    console.error('Fallback copy failed:', error);
    document.body.removeChild(textarea);
    return false;
  }
}
