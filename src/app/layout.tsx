import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from '@vercel/analytics/react';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Worship Ministry App",
  description: "Plan, share, and coordinate your worship team. Chord charts, team rosters, setlists, and more — all in one place.",
  openGraph: {
    title: "Worship Ministry App",
    description: "Plan, share, and coordinate your worship team. Chord charts, team rosters, setlists, and more — all in one place.",
    url: "https://worship.gracetoyou.com.au",
    siteName: "Worship Ministry App",
    images: [
      {
        url: "/og-wordcc.png",
        width: 1200,
        height: 630,
        alt: "Worship Ministry App",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Worship Ministry App",
    description: "Plan, share, and coordinate your worship team. Chord charts, team rosters, setlists, and more — all in one place.",
    images: ["/og-wordcc.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
