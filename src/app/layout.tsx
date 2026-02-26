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
  title: "WORDCC | Worship Ministry App",
  description: "WORDCC - Plan, share, and play your worship setlists with ease. Chord charts, team rosters, and more—all in one place for WORDCC Church.",
  openGraph: {
    title: "WORDCC | Worship Ministry App",
    description: "WORDCC - Plan, share, and play your worship setlists with ease. Chord charts, team rosters, and more—all in one place for WORDCC Church.",
    url: "https://YOUR_PROD_URL_HERE", // Replace with your actual prod URL
    siteName: "WORDCC",
    images: [
      {
        url: "/og-wordcc.png",
        width: 1200,
        height: 630,
        alt: "WORDCC Logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WORDCC | Worship Ministry App",
    description: "WORDCC - Plan, share, and play your worship setlists with ease. Chord charts, team rosters, and more—all in one place for WORDCC Church.",
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
