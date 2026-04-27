import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ninja Typing / \u5fcd\u8005\u30bf\u30a4\u30d4\u30f3\u30b0",
  description: "A cyber shinobi typing game built with Next.js, React, TypeScript, Tailwind CSS, and Framer Motion."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
