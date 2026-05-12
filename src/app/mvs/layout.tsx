import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MVS',
};

// Day 11.5 polish: apply marketing-site typography to all /mvs/* admin
// routes. mvs-body sets the body font to IBM Plex Sans (same as the public
// site); descendants opt into mvs-display (Saira Condensed) or mvs-mono
// (Plex Mono) per the existing utility classes in globals.css. White
// content panels are intentionally preserved for readability inside admin
// tables and forms.
export default function MvsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="mvs-body">{children}</div>;
}
