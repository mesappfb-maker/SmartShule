import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ss/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SmartShule — Portail famille",
  description:
    "SmartShule — L'intelligence qui rapproche l'école et la famille. Portail parents, élèves et direction.",
  keywords: [
    "SmartShule",
    "école",
    "portail parents",
    "gestion scolaire",
    "bulletins",
  ],
  authors: [{ name: "SmartShule" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "SmartShule — Portail famille",
    description:
      "L'intelligence qui rapproche l'école et la famille.",
    siteName: "SmartShule",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <Toaster />
        <SonnerToaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}
