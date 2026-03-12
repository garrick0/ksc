'use client';

import Link from 'next/link';
import { parts } from '@/lib/lessons';

export default function TutorialIndex() {
  return (
    <div style={{ padding: '3rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem' }}>Interactive Tutorial</h1>
      <p style={{ fontSize: '1.125rem', color: '#666', marginBottom: '1.5rem' }}>
        Learn KindScript by running real code in your browser. No installation required.
      </p>

      {/* Sandbox Mode Banner */}
      <Link
        href="/sandbox"
        style={{
          display: 'block',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '1.5rem',
          borderRadius: '12px',
          textDecoration: 'none',
          marginBottom: '3rem',
          border: 'none',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2.5rem' }}>🧪</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              Try Sandbox Mode
            </div>
            <div style={{ fontSize: '0.95rem', opacity: 0.95 }}>
              Experiment beyond the lessons. Create, modify, and architect real projects with full file control.
            </div>
          </div>
          <div style={{ fontSize: '1.5rem' }}>→</div>
        </div>
      </Link>

      <div style={{ display: 'grid', gap: '2rem' }}>
        {parts.map((part) => (
          <div
            key={part.number}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '1.5rem',
              background: '#fafafa',
            }}
          >
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem' }}>
              Part {part.number}: {part.title}
            </h2>
            <p style={{ color: '#666', marginBottom: '1rem' }}>
              {part.lessons.length} lesson{part.lessons.length !== 1 ? 's' : ''}
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {part.lessons.map((lesson) => (
                <li key={lesson.slug} style={{ marginBottom: '0.5rem' }}>
                  <Link
                    href={`/tutorial/${lesson.slug}`}
                    style={{
                      display: 'block',
                      padding: '0.75rem 1rem',
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      color: '#111',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>
                      {lesson.partNumber}.{lesson.lessonNumber} {lesson.title}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
