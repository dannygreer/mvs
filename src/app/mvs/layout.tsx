import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MVS',
};

export default function MvsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
