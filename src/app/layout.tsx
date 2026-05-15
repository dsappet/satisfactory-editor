import type { Metadata, Viewport } from "next";
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

const SITE_URL = "https://satisfactory-editor.com";
const SITE_NAME = "Satisfactory Save Editor";
const SITE_TITLE =
  "Satisfactory Save Editor — Edit Your 1.2 .sav in the Browser";
const SITE_DESCRIPTION =
  "Free, fully client-side editor for Satisfactory 1.2 save files. Edit resource node purity, inventory and hand slots, MAM research, and hard-drive alternate recipes — your save never leaves your browser.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s · Satisfactory Save Editor",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "Satisfactory save editor",
    "Satisfactory 1.2",
    "edit .sav file",
    "Satisfactory save game",
    "resource purity editor",
    "MAM research unlock",
    "hard drive alternate recipes",
    "client-side save editor",
    "Coffee Stain Studios",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  category: "utility",
};

export const viewport: Viewport = {
  themeColor: "#0e3c4a",
  colorScheme: "dark",
};

// JSON-LD describing the editor as a free, browser-based WebApplication.
// Inlined because that's the form crawlers expect; the CSP already allows
// `script-src 'unsafe-inline'` so no nonce is required.
const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "GameApplication",
  applicationSubCategory: "Save Editor",
  operatingSystem: "Any (modern web browser)",
  browserRequirements: "Requires JavaScript and Web Worker support.",
  inLanguage: "en",
  isAccessibleForFree: true,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Edit resource node purity (Impure / Normal / Pure)",
    "Bump inventory and arm-equipment slot counts",
    "Unlock or lock any MAM research schematic",
    "Unlock or lock hard-drive alternate recipes",
  ],
  about: {
    "@type": "VideoGame",
    name: "Satisfactory",
    publisher: { "@type": "Organization", name: "Coffee Stain Studios" },
  },
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
        <script
          type="application/ld+json"
          // Crawlers parse this; no XSS surface — content is a fixed object.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
