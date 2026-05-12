import type { Metadata } from "next";
import {
  Poppins,
  Inter,
  Saira_Condensed,
  IBM_Plex_Sans,
  IBM_Plex_Mono,
} from "next/font/google";
import "./globals.css";

// Legacy fonts — kept loaded so existing admin/portal pages keep their
// look until we sweep them onto the new marketing palette.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Marketing-site fonts.
//   - Saira Condensed → display headlines (uppercase, militaristic feel).
//     display: 'block' so the browser briefly hides text rather than
//     painting the metric-matched fallback and then visibly swapping —
//     the condensed letterforms can't be approximated by a system fallback.
//   - IBM Plex Sans   → body copy, default. swap is fine here.
//   - IBM Plex Mono   → HUD chrome. block matches the display headlines so
//     mono chrome doesn't reflow either.
const sairaCondensed = Saira_Condensed({
  variable: "--font-saira-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "block",
  preload: true,
});
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  preload: true,
});
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "block",
  preload: true,
});

export const metadata: Metadata = {
  title: "MVS",
  description: "MVS",
  // Favicon auto-detected from src/app/icon.png + src/app/apple-icon.png by
  // Next.js App Router. No explicit `icons` field — that would override and
  // break the file-based convention.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${inter.variable} ${sairaCondensed.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col"
        style={{ fontFamily: 'var(--font-plex-sans), system-ui, sans-serif' }}
      >
        {children}
      </body>
    </html>
  );
}
