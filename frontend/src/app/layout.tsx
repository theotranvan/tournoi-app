import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/lib/query-provider";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { ThemeScript } from "@/components/ui/theme-script";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kickoff — Gestion de tournois",
  description:
    "Organisez, planifiez et suivez vos tournois de football en temps réel.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kickoff",
  },
  openGraph: {
    title: "Kickoff — Gestion de tournois",
    description:
      "Organisez, planifiez et suivez vos tournois de football en temps réel.",
    siteName: "Kickoff",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Kickoff — Gestion de tournois",
    description:
      "Organisez, planifiez et suivez vos tournois de football en temps réel.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${inter.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col">
        <QueryProvider>{children}</QueryProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            className: "!bg-card !text-card-foreground !border-border",
          }}
        />
        <ServiceWorkerRegister />
        <InstallPrompt />
      </body>
    </html>
  );
}
