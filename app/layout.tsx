import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import UsernameOnboarding from "@/components/UsernameOnboarding";
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
      <body className={`${inter.className} antialiased`}>
        <AuthProvider>
          {children}
          <UsernameOnboarding />
        </AuthProvider>
      </body>
    </html>
  );
}
