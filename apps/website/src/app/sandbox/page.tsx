import { Metadata } from 'next';
import { SandboxLayout } from '@/components/tutorial/SandboxLayout';

export const metadata: Metadata = {
  title: 'Sandbox | KindScript',
  description: 'Experiment with KindScript architectural patterns in a full development environment',
};

export default function SandboxPage() {
  return <SandboxLayout />;
}
