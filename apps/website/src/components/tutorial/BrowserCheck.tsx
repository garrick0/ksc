'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface BrowserCheckProps {
  children: React.ReactNode;
}

interface BrowserSupport {
  isSupported: boolean;
  hasSharedArrayBuffer: boolean;
  isCrossOriginIsolated: boolean;
  isDevelopment: boolean;
}

export function BrowserCheck({ children }: BrowserCheckProps) {
  const [support, setSupport] = useState<BrowserSupport | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
    const isCrossOriginIsolated = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;
    const isDevelopment = process.env.NODE_ENV === 'development';

    const isSupported = hasSharedArrayBuffer && isCrossOriginIsolated;

    setSupport({
      isSupported,
      hasSharedArrayBuffer,
      isCrossOriginIsolated,
      isDevelopment,
    });
  }, []);

  if (support === null) {
    // Loading state
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#1e293b',
          color: 'white',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '600px', padding: '2rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
          <div>Checking browser compatibility...</div>
        </div>
      </div>
    );
  }

  if (support.isSupported) {
    return <>{children}</>;
  }

  // Show warning/error screen - not supported
  const title = 'Desktop Browser Required';
  const message = 'The interactive tutorial uses WebContainers to run a full Node.js environment in your browser. This requires modern browser features that aren\'t available on all devices.';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
        <div style={{ fontSize: '3rem', marginBottom: '1rem', textAlign: 'center' }}>💻</div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '1rem', textAlign: 'center', color: '#1e293b' }}>
          {title}
        </h1>
        <p style={{ fontSize: '1.125rem', lineHeight: '1.75', color: '#475569', marginBottom: '1.5rem' }}>
          {message}
        </p>

        <div
          style={{
            background: '#f1f5f9',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
            <strong>Supported browsers:</strong>
          </p>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.5rem', color: '#475569' }}>
            <li>Chrome/Edge 92+</li>
            <li>Firefox 95+</li>
            <li>Safari 15.2+</li>
          </ul>
        </div>

        {/* Debug info */}
        {showDebug && (
          <div
            style={{
              background: '#fef3c7',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              fontSize: '0.875rem',
            }}
          >
            <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: '#92400e' }}>Debug Info:</p>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#92400e' }}>
              <li>SharedArrayBuffer: {support.hasSharedArrayBuffer ? '✅' : '❌'}</li>
              <li>Cross-Origin Isolated: {support.isCrossOriginIsolated ? '✅' : '❌'}</li>
              <li>Development Mode: {support.isDevelopment ? '✅' : '❌'}</li>
            </ul>
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/docs/tutorial-guide"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              background: '#3b82f6',
              color: 'white',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Read Static Tutorial
          </Link>
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
          <button
            onClick={() => setShowDebug(!showDebug)}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#6b7280',
              color: 'white',
              borderRadius: '6px',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {showDebug ? 'Hide' : 'Show'} Debug Info
          </button>
        </div>
      </div>
    </div>
  );
}
