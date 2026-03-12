'use client';

import { useParams } from 'next/navigation';
import { getLessonBySlug } from '@/lib/lessons';
import { TutorialLayout } from '@/components/tutorial/TutorialLayout';
import { BrowserCheck } from '@/components/tutorial/BrowserCheck';
import { ErrorBoundary } from '@/components/tutorial/ErrorBoundary';

export default function LessonPage() {
  const params = useParams();
  const lesson = getLessonBySlug(params.lesson as string);

  if (!lesson) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Lesson not found</h1>
        <p>The lesson "{params.lesson}" does not exist.</p>
        <a href="/tutorial" style={{ color: '#3b82f6' }}>
          ← Back to lessons
        </a>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <BrowserCheck>
        <TutorialLayout lesson={lesson} />
      </BrowserCheck>
    </ErrorBoundary>
  );
}
