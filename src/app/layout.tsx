import type { Metadata } from "next";
import { Geist_Mono, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description = "A glowing cloud that runs your ongoing work with a crew of Nemotron agents, asks before it acts, and learns from every run.";

export const metadata: Metadata = {
  // absolute URLs for the share image: the public deployment's address when set
  metadataBase: new URL(process.env.NIMBUS_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`),
  title: "Nimbus",
  description,
  // the pixel-art mark is the icon; the glow cloud stays the in-app character
  icons: {
    // app/favicon.ico (16, 32, 64) is linked by Next itself
    icon: [{ url: "/brand/nimbus-icon-512.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: { title: "Nimbus", description, images: [{ url: "/brand/og-paper-1200x630.jpg", width: 1200, height: 630, alt: "Nimbus" }] },
  twitter: { card: "summary_large_image", title: "Nimbus", description, images: ["/brand/og-paper-1200x630.jpg"] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${manrope.variable} ${geistMono.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
