import type { ReactNode } from 'react';

export default function TutorialLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ height: '100vh', overflow: 'auto' }}>
      {children}
    </div>
  );
}
