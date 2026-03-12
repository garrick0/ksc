'use client';

import { useEffect, useState } from 'react';
import { config } from '@/lib/config';

interface LoadingOverlayProps {
  state: 'idle' | 'booting' | 'installing' | 'ready' | 'error';
}

export function LoadingOverlay({ state }: LoadingOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Reset progress when state changes
  useEffect(() => {
    if (state === 'booting' || state === 'installing') {
      setProgress(0);
      setElapsedTime(0);
    }
  }, [state]);

  // Progress simulation for installing state
  useEffect(() => {
    if (state !== 'installing') return;

    const startTime = Date.now();
    const targetDuration = config.webcontainer.expectedInstallMs;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setElapsedTime(Math.floor(elapsed / 1000));

      // Exponential curve that reaches 95% at target duration, then slows
      const percentage = Math.min(config.webcontainer.progressCeiling + 5, (elapsed / targetDuration) * 90 + Math.log(elapsed / 1000 + 1) * 5);
      setProgress(Math.round(percentage));
    }, config.webcontainer.progressIntervalMs);

    return () => clearInterval(interval);
  }, [state]);

  // Progress for booting state (faster)
  useEffect(() => {
    if (state !== 'booting') return;

    const startTime = Date.now();
    const targetDuration = config.webcontainer.expectedBootMs;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setElapsedTime(Math.floor(elapsed / 1000));
      const percentage = Math.min(config.webcontainer.progressCeiling, (elapsed / targetDuration) * config.webcontainer.progressCeiling);
      setProgress(Math.round(percentage));
    }, config.webcontainer.progressIntervalMs);

    return () => clearInterval(interval);
  }, [state]);

  if (state === 'ready' || state === 'idle') return null;

  const messages = {
    booting: {
      icon: '⚡',
      title: 'Booting WebContainer',
      subtitle: 'Starting the browser-based Node.js environment...',
    },
    installing: {
      icon: '📦',
      title: 'Installing Dependencies',
      subtitle: `Running npm install... ${elapsedTime}s elapsed`,
    },
    error: {
      icon: '❌',
      title: 'Error',
      subtitle: 'WebContainer failed to start. Check the terminal for details.',
    },
  };

  const message = messages[state as keyof typeof messages];
  const estimatedRemaining = state === 'installing' ? Math.max(0, Math.floor(config.webcontainer.expectedInstallMs / 1000) - elapsedTime) : 0;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message.title}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: config.zIndex.overlay,
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '3rem',
          maxWidth: '500px',
          textAlign: 'center',
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.3)',
        }}
      >
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>{message.icon}</div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#1e293b' }}>{message.title}</h2>
        <p style={{ color: '#64748b', fontSize: '1rem', marginBottom: '1.5rem' }}>{message.subtitle}</p>

        {state !== 'error' && (
          <>
            {/* Progress Bar */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{
                width: '100%',
                height: '8px',
                background: '#e2e8f0',
                borderRadius: '4px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
                  transition: 'width 0.3s ease-out',
                  borderRadius: '4px',
                }} />
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '0.5rem',
                fontSize: '0.875rem',
                color: '#64748b',
              }}>
                <span>{progress}%</span>
                {estimatedRemaining > 0 && (
                  <span>~{estimatedRemaining}s remaining</span>
                )}
              </div>
            </div>

            {/* Loading Dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#3b82f6',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#3b82f6',
                  animation: 'pulse 1.5s ease-in-out 0.3s infinite',
                }}
              />
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#3b82f6',
                  animation: 'pulse 1.5s ease-in-out 0.6s infinite',
                }}
              />
            </div>
          </>
        )}
        <style jsx>{`
          @keyframes pulse {
            0%,
            100% {
              opacity: 0.3;
            }
            50% {
              opacity: 1;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
