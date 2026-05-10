import type { Metadata } from "next";
import { Geist, Geist_Mono, Oxanium } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Industrial / tech-leaning display face — closest free analogue to the
// Satisfactory UI typography. Self-hosted by next/font/google at build time,
// so no runtime external requests.
const oxanium = Oxanium({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Satisfactory Save Editor",
  description:
    "Static, fully client-side editor for Satisfactory 1.2 save files. Your save never leaves your browser.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${oxanium.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
