import { FileSystemTree } from '@webcontainer/api';
import { LessonFile } from '../lessons/types';

export function filesToFileSystemTree(files: LessonFile[]): FileSystemTree {
  const tree: FileSystemTree = {};

  for (const file of files) {
    const parts = file.path.split('/');
    let current: any = tree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        current[part] = {
          file: {
            contents: file.contents,
          },
        };
      } else {
        if (!current[part]) {
          current[part] = {
            directory: {},
          };
        }
        current = current[part].directory;
      }
    }
  }

  return tree;
}
