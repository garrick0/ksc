'use client';

import Link from 'next/link';
import { Lesson } from '@/lib/lessons/types';
import { getNextLesson, getPrevLesson } from '@/lib/lessons';

interface LessonNavProps {
  lesson: Lesson;
}

export function LessonNav({ lesson }: LessonNavProps) {
  const prev = getPrevLesson(lesson.slug);
  const next = getNextLesson(lesson.slug);

  return (
    <div
      style={{
        background: '#f8fafc',
        borderTop: '1px solid #e5e7eb',
        padding: '1rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
      }}
    >
      <div>
        {prev && (
          <Link
            href={`/tutorial/${prev.slug}`}
            style={{
              color: '#3b82f6',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>←</span>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Previous</div>
              <div style={{ fontWeight: 500 }}>{prev.title}</div>
            </div>
          </Link>
        )}
      </div>
      <div>
        {next && (
          <Link
            href={`/tutorial/${next.slug}`}
            style={{
              color: '#3b82f6',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              textAlign: 'right',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Next</div>
              <div style={{ fontWeight: 500 }}>{next.title}</div>
            </div>
            <span>→</span>
          </Link>
        )}
      </div>
    </div>
  );
}
