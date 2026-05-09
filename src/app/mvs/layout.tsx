import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MVS',
  icons: {
    icon: '/mvs-icon.png',
  },
};

export default function MvsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
