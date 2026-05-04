import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { AuthProvider } from "@/lib/auth-context";
import UsernameOnboarding from "@/components/UsernameOnboarding";
import AdBanner from "@/components/AdBanner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pronoscore — Pronostics Ligue 1",
  description: "POC Application de pronostics pour la Ligue 1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5354365570630231"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body className={`${inter.className} antialiased`}>
        <AuthProvider>
          {children}
          <UsernameOnboarding />
        </AuthProvider>
        <AdBanner />
      </body>
    </html>
  );
}
