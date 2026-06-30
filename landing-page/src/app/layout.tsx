import type { Metadata } from "next";
import { Instrument_Sans, Outfit } from "next/font/google";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CrediiFlow | Enterprise Cash Collection & Operations Platform",
  description: "Automate cash collection operations, track denominations, maintain retailer ledger history, and streamline bank deposits. A secure, offline-first, multi-tenant SaaS platform.",
  keywords: [
    "CrediiFlow",
    "Cash Collection",
    "Cash Management Platform",
    "Multi-tenant SaaS",
    "Retailer Ledger",
    "Khatabook Operations",
    "Offline-first PWA",
    "KM Tracking",
    "Bank Deposit Verification",
    "Audit Logs",
    "FastAPI",
    "Next.js"
  ],
  authors: [{ name: "CrediiFlow Team" }],
  metadataBase: new URL("https://crediiflow.in"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "CrediiFlow | Enterprise Cash Collection & Operations Platform",
    description: "Automate cash collection operations, track denominations, maintain retailer ledger history, and streamline bank deposits. A secure, offline-first, multi-tenant SaaS platform.",
    url: "https://crediiflow.in",
    siteName: "CrediiFlow",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CrediiFlow | Enterprise Cash Collection & Operations Platform",
    description: "Automate cash collection operations, track denominations, maintain retailer ledger history, and streamline bank deposits. A secure, offline-first, multi-tenant SaaS platform.",
  },
  icons: {
    icon: "/logo.png",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-white text-slate-900 flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
