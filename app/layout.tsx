import type { Metadata } from "next";
import { NextAuthProvider } from "@/components/providers/session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReadmeForge — Engineering-Grade README Generator",
  description: "AST structure parsing, single-call git tree inspection, team contributor grids, and visual architecture topologies.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased selection:bg-neutral-800 selection:text-neutral-100">
        <NextAuthProvider>{children}</NextAuthProvider>
      </body>
    </html>
  );
}
