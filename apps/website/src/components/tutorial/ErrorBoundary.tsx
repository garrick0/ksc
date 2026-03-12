'use client';

import React from 'react';
import Link from 'next/link';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Tutorial error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: '#1e293b',
            padding: '2rem',
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '3rem',
              maxWidth: '600px',
              boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem', textAlign: 'center' }}>⚠️</div>
            <h1 style={{ fontSize: '1.75rem', marginBottom: '1rem', textAlign: 'center', color: '#1e293b' }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: '1.125rem', lineHeight: '1.75', color: '#475569', marginBottom: '1.5rem' }}>
              The tutorial encountered an unexpected error and couldn't recover.
            </p>
            {this.state.error && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  padding: '1rem',
                  borderRadius: '6px',
                  marginBottom: '1.5rem',
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                  color: '#991b1b',
                  overflow: 'auto',
                  maxHeight: '200px',
                }}
              >
                {this.state.error.toString()}
              </div>
            )}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Reload Page
              </button>
              <Link
                href="/tutorial"
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  background: '#e5e7eb',
                  color: '#1e293b',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                ← Back to Lessons
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
