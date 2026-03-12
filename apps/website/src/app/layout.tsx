import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KindScript',
  description: 'Architectural enforcement for TypeScript through the type system',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
