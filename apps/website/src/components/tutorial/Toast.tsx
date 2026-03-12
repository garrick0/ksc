'use client';

import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type, duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for fade-out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const colors = {
    success: { bg: '#10b981', text: 'white' },
    error: { bg: '#ef4444', text: 'white' },
    info: { bg: '#3b82f6', text: 'white' },
  };

  const color = colors[type];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        background: color.bg,
        color: color.text,
        padding: '0.75rem 1rem',
        borderRadius: '4px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        zIndex: 3000,
        fontSize: '0.875rem',
        fontWeight: 500,
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 300ms',
        maxWidth: '300px',
      }}
    >
      {message}
    </div>
  );
}

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

let nextToastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: ToastType = 'info') => {
    const id = ++nextToastId;
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const ToastContainer = () => (
    <>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </>
  );

  return { showToast, ToastContainer };
}
