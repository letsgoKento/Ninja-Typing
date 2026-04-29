import type { Metadata } from "next";
import type { Viewport } from "next";
import { FAVICON_PATH, OG_IMAGE_PATH, SITE_BRAND, SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, getSiteUrl } from "@/lib/site";
import "./globals.css";

const siteUrl = getSiteUrl();
const ogImage = {
  url: OG_IMAGE_PATH,
  width: 1731,
  height: 909,
  alt: "Ninja Typing / 忍者タイピング - 手裏剣が飛ぶ爽快タイピングゲーム"
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: SITE_NAME,
  title: {
    default: `${SITE_NAME} | 無料ブラウザタイピングゲーム`,
    template: `%s | ${SITE_BRAND}`
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  authors: [{ name: SITE_BRAND, url: siteUrl }],
  creator: SITE_BRAND,
  publisher: SITE_BRAND,
  category: "game",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "/",
    siteName: SITE_NAME,
    title: `${SITE_NAME} | 手裏剣が飛ぶ爽快タイピングゲーム`,
    description: SITE_DESCRIPTION,
    images: [ogImage]
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | 手裏剣が飛ぶ爽快タイピングゲーム`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE_PATH,
        alt: ogImage.alt
      }
    ]
  },
  icons: {
    icon: [{ url: FAVICON_PATH, type: "image/png", sizes: "1254x1254" }],
    shortcut: [FAVICON_PATH],
    apple: [{ url: FAVICON_PATH, type: "image/png", sizes: "1254x1254" }]
  },
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  formatDetection: {
    telephone: false,
    address: false,
    email: false
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#05070f",
  colorScheme: "dark"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9092971490160530"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
