export interface LessonFile {
  path: string;
  contents: string;
}

export interface Lesson {
  slug: string;
  title: string;
  partTitle: string;
  partNumber: number;
  lessonNumber: number;
  focus: string; // Default file to open
  files: LessonFile[];
  solution: LessonFile[];
}

export interface Part {
  number: number;
  title: string;
  lessons: Lesson[];
}
