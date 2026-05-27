import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "動画編集AI",
  description: "AI字幕生成・動画編集アプリ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="h-full" suppressHydrationWarning>
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
