'use client';

import { Lesson } from '@/lib/lessons/types';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import './lesson-content.css';

interface LessonContentProps {
  lesson: Lesson;
}

// Custom component for callouts (:::tip, :::info, etc.)
function parseCallouts(content: string): string {
  return content.replace(
    /:::(\w+)\n([\s\S]*?)\n:::/g,
    (_, type, text) => {
      // Return markdown blockquote format that react-markdown can handle
      return `> **${type.toUpperCase()}**\n>\n> ${text.trim().replace(/\n/g, '\n> ')}`;
    }
  );
}

export function LessonContent({ lesson }: LessonContentProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/lessons/${lesson.slug}.mdx`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        const processed = parseCallouts(text);
        setContent(processed);
        setLoading(false);
      })
      .catch(() => {
        setContent(`# ${lesson.title}\n\nContent could not be loaded. Please try refreshing the page.`);
        setLoading(false);
      });
  }, [lesson.slug, lesson.title]);

  return (
    <div style={{ padding: '2rem', maxWidth: '700px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
          Lesson {lesson.partNumber}.{lesson.lessonNumber}
        </div>
        <h1 style={{ margin: 0, fontSize: '2rem', lineHeight: 1.2, color: '#0f172a' }}>{lesson.title}</h1>
      </div>
      {loading ? (
        <div style={{ color: '#64748b' }}>Loading...</div>
      ) : (
        <div className="lesson-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
